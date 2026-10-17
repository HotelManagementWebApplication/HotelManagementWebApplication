import type { Service } from "../../shared/types/kitchenAccounting";
import { formatVnd } from "../../shared/utils/money";

type PriceApproval = { amount?: number | null; payload: string; target_id: string; requester: string; reason: string; expires_at?: string | null };

export function proposedPrice(approval: { amount?: number | null; payload: string }): number | null {
  let value: unknown = approval.amount;
  if (value === null || value === undefined) {
    try {
      const payload: unknown = JSON.parse(approval.payload);
      value = typeof payload === "object" && payload !== null ? (payload as { price?: unknown }).price : payload;
    } catch { return null; }
  }
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export function priceReviewDetails(approval: PriceApproval, services: Service[], employees: { employee_id: string; full_name: string }[]): string[] {
  const service = services.find(item => item.id === approval.target_id);
  const employee = employees.find(item => item.employee_id === approval.requester);
  const price = proposedPrice(approval);
  return [
    `${service?.name ?? approval.target_id} (${approval.target_id})`,
    `Giá hiện tại: ${service ? formatVnd(service.price) : "Chưa tải được"} · Giá đề xuất: ${price === null ? "Không hợp lệ" : formatVnd(price)}`,
    `Người đề nghị: ${employee?.full_name ?? approval.requester} (${approval.requester})`,
    `Lý do: ${approval.reason}`,
    `Hạn xử lý: ${approval.expires_at ? new Date(approval.expires_at).toLocaleString("vi-VN") : "Không giới hạn"}`,
  ];
}
