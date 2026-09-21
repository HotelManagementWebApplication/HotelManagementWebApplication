import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { housekeepingTechnicalApi } from "./housekeepingTechnical";
import { ROOM_STATUS_VALUES } from "../types/housekeepingTechnical";

describe("housekeeping and technical API contract", () => {
  const request = vi.spyOn(apiClient, "request");
  beforeEach(() => { request.mockReset(); request.mockResolvedValue([]); });

  it("keeps room status values on the canonical operational contract", () => {
    expect(ROOM_STATUS_VALUES).toEqual(["available", "occupied", "cleaning", "maintenance", "out_of_service", "reserved"]);
  });

  it("uses exact read paths and query names", async () => {
    await housekeepingTechnicalApi.tasks({ roomId: "101", status: "NEEDS_CLEANING" });
    await housekeepingTechnicalApi.checklistTemplates();
    await housekeepingTechnicalApi.workOrders({ roomId: "101", status: "WAITING_ACCEPTANCE" });
    await housekeepingTechnicalApi.equipment("101");
    await housekeepingTechnicalApi.maintenance("101");
    await housekeepingTechnicalApi.rooms({ status: "maintenance" });
    await housekeepingTechnicalApi.availability("2026-09-18T00:00:00Z", "2026-09-19T00:00:00Z", "DELUXE");
    expect(request.mock.calls.map(call => call[0])).toEqual([
      "/api/operations/housekeeping/tasks?roomId=101&status=NEEDS_CLEANING",
      "/api/operations/housekeeping/checklist-templates",
      "/api/operations/technical/work-orders?roomId=101&status=WAITING_ACCEPTANCE",
      "/api/rooms/101/equipment", "/api/operations/maintenance/room/101",
      "/api/rooms?status=maintenance", "/api/rooms/availability?from=2026-09-18T00%3A00%3A00Z&to=2026-09-19T00%3A00%3A00Z&type=DELUXE",
    ]);
  });

  it("sends the exact acceptance body and idempotency header options", async () => {
    await housekeepingTechnicalApi.accept(12, { acceptance_note: "Đã nghiệm thu" });
    await housekeepingTechnicalApi.release(12);
    expect(request.mock.calls[0]).toEqual(["/api/operations/technical/work-orders/12/accept", expect.objectContaining({ method: "POST", body: { acceptance_note: "Đã nghiệm thu" }, idempotencyKey: expect.any(String) })]);
    expect(request.mock.calls[1]).toEqual(["/api/operations/technical/work-orders/12/release", expect.objectContaining({ method: "POST", idempotencyKey: expect.any(String) })]);
    expect((request.mock.calls[0][1] as { idempotencyKey: string }).idempotencyKey).not.toBe((request.mock.calls[1][1] as { idempotencyKey: string }).idempotencyKey);
  });

  it("covers every current housekeeping and technical write path with snake_case bodies", async () => {
    const options = { idempotencyKey: "stable-retry-key" };
    await housekeepingTechnicalApi.createTask({ room_id: "101", assignee: "hk-1", note: "checkout" }, options);
    await housekeepingTechnicalApi.updateTask(1, { status: "IN_PROGRESS", note: "started" }, options);
    await housekeepingTechnicalApi.createChecklistTemplate({ name: "Bed" }, options);
    await housekeepingTechnicalApi.addChecklistResult(1, { item: "Bed", passed: true }, options);
    await housekeepingTechnicalApi.addInspection(1, { inspection_type: "MINIBAR", item: "Water", quantity: 2, item_condition: "OK" }, options);
    await housekeepingTechnicalApi.recordIncident(55, { room_id: "101", equipment_name: "TV", quantity: 1, severity: "HIGH" }, options);
    await housekeepingTechnicalApi.createIncident({ room_id: "101", equipment_name: "TV", quantity: 1, severity: "HIGH" }, options);
    await housekeepingTechnicalApi.handoffIncident(9, { status: "ACKNOWLEDGED", note: "sent to technical" }, options);
    await housekeepingTechnicalApi.createMaintenance({ id: "M-1", room_id: "101", type: "AC", scheduled_date: "2026-09-19" }, options);
    await housekeepingTechnicalApi.updateMaintenanceStatus("M-1", { status: "DANG_BAO_TRI" }, options);
    await housekeepingTechnicalApi.addEquipment({ room_id: "101", name: "TV", original_value: 100, purchased_on: "2026-01-01", quantity: 1 }, options);
    await housekeepingTechnicalApi.updateEquipment("101", 3, { name: "TV", original_value: 100, purchased_on: "2026-01-01", quantity: 1, active: true }, options);
    await housekeepingTechnicalApi.createWorkOrder({ room_id: "101", priority: "HIGH" }, options);
    await housekeepingTechnicalApi.updateWorkOrder(2, { status: "ACKNOWLEDGED" }, options);
    await housekeepingTechnicalApi.updateRoomStatus("101", "maintenance", options);

    expect(request.mock.calls.map(call => call[0])).toEqual([
      "/api/operations/housekeeping/tasks", "/api/operations/housekeeping/tasks/1", "/api/operations/housekeeping/checklist-templates",
      "/api/operations/housekeeping/tasks/1/checklist-results", "/api/operations/housekeeping/tasks/1/inspections",
      "/api/operations/reservations/55/equipment-incidents", "/api/operations/incidents", "/api/operations/reservations/incidents/9/handoff",
      "/api/operations/maintenance", "/api/operations/maintenance/M-1/status", "/api/rooms/101/equipment", "/api/rooms/101/equipment/3",
      "/api/operations/technical/work-orders", "/api/operations/technical/work-orders/2", "/api/rooms/101/status?status=maintenance",
    ]);
    for (const [, callOptions] of request.mock.calls) expect((callOptions as { idempotencyKey: string }).idempotencyKey).toBe("stable-retry-key");
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST", body: { room_id: "101", assignee: "hk-1", note: "checkout" } }));
    expect(request.mock.calls[2][1]).toEqual(expect.objectContaining({ body: { name: "Bed" } }));
    expect(request.mock.calls[5][1]).toEqual(expect.objectContaining({ body: { room_id: "101", equipment_name: "TV", quantity: 1, severity: "HIGH" } }));
  });
});
