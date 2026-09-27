import { afterAll, describe, expect, it } from "vitest";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;
type LiveResponse = { status: number; body: Json | undefined };
type Env = Record<string, string | undefined>;

const processLike = (globalThis as typeof globalThis & { process?: { env: Env } }).process;
const env = processLike?.env ?? {};
const baseUrl = env.E2E_API_BASE_URL?.trim().replace(/\/$/, "");

let skippedScenarios = 0;
let configuredScenarios = 0;
let blockedScenarios = 0;

function value(name: string): string | undefined {
  const result = env[name]?.trim();
  return result || undefined;
}

function missing(...names: string[]): string[] {
  return names.filter(name => name === "E2E_SQLSERVER_DISPOSABLE=true"
    ? env.E2E_SQLSERVER_DISPOSABLE === undefined || env.E2E_SQLSERVER_DISPOSABLE.trim() === ""
    : !value(name));
}

function requirements(needsDisposableSchema: boolean, names: string[]): string[] {
  return needsDisposableSchema
    ? [...names, "E2E_SQLSERVER_DATABASE", "E2E_SQLSERVER_DISPOSABLE=true"]
    : names;
}

function block(label: string, reason: string): never {
  throw new Error(`[E2E][BLOCK] ${label}: ${reason}`);
}

function validateEnvironment(label: string, needsDisposableSchema: boolean): void {
  if (!baseUrl) block(label, "E2E_API_BASE_URL is empty");
  let parsed: URL;
  try {
    parsed = new URL(baseUrl!);
  } catch {
    block(label, `E2E_API_BASE_URL is not an absolute URL: ${baseUrl}`);
  }
  if (!(parsed!.protocol === "http:" || parsed!.protocol === "https:")) {
    block(label, `E2E_API_BASE_URL must use http or https: ${baseUrl}`);
  }
  if (parsed!.pathname !== "" && parsed!.pathname !== "/") {
    block(label, `E2E_API_BASE_URL must not include an API path: ${baseUrl}`);
  }

  if (needsDisposableSchema) {
    if (env.E2E_SQLSERVER_DISPOSABLE?.trim() !== "true") {
      block(label, "E2E_SQLSERVER_DISPOSABLE must be exactly true; refusing to mutate a non-disposable database");
    }
    const schema = value("E2E_SQLSERVER_DATABASE");
    if (!schema || !/^e2e_[A-Za-z0-9_]+$/.test(schema)) {
      block(label, "E2E_SQLSERVER_DATABASE must be a disposable database named e2e_<name>");
    }
  }
}

function positiveInteger(label: string, name: string): number {
  const raw = value(name);
  const parsed = Number(raw);
  if (!raw || !Number.isSafeInteger(parsed) || parsed <= 0) {
    block(label, `${name} must be a positive integer`);
  }
  return parsed;
}

function positiveNumber(label: string, name: string): number {
  const raw = value(name);
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
    block(label, `${name} must be a positive number`);
  }
  return parsed;
}

function localDateTime(label: string, name: string): string {
  const raw = value(name);
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) {
    block(label, `${name} must be an ISO local date-time such as 2031-01-10T14:00:00`);
  }
  return raw;
}

function distinct(label: string, firstName: string, secondName: string): void {
  if (value(firstName) === value(secondName)) {
    block(label, `${firstName} and ${secondName} must identify different actors`);
  }
}

function liveTest(
  label: string,
  needsDisposableSchema: boolean,
  names: string[],
  scenario: () => Promise<void>,
) {
  const required = requirements(needsDisposableSchema, names);
  const absent = missing(...required);
  if (absent.length > 0) {
    skippedScenarios += 1;
    const reason = `missing prerequisites: ${absent.join(", ")}`;
    console.warn(`[E2E][SKIP] ${label}: ${reason}`);
    return it.skip(`[E2E][SKIP] ${label} (${reason})`, () => undefined);
  }

  configuredScenarios += 1;
  return it(`[E2E][LIVE] ${label}`, async () => {
    try {
      validateEnvironment(label, needsDisposableSchema);
      await scenario();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("[E2E][BLOCK]")) blockedScenarios += 1;
      throw error;
    }
  });
}

function responseText(body: Json | undefined): string {
  return body === undefined ? "<empty>" : JSON.stringify(body);
}

function expectStatus(response: LiveResponse, expected: number | number[], label: string): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  expect(allowed, `[E2E][FAIL] ${label}; body=${responseText(response.body)}`).toContain(response.status);
}

function jsonObject(valueToCheck: unknown, label = "JSON object"): Record<string, unknown> {
  expect(valueToCheck, `[E2E][FAIL] ${label}`).toBeTypeOf("object");
  expect(Array.isArray(valueToCheck), `[E2E][FAIL] ${label} must not be an array`).toBe(false);
  return valueToCheck as Record<string, unknown>;
}

function jsonArray(valueToCheck: unknown, label = "JSON array"): unknown[] {
  expect(Array.isArray(valueToCheck), `[E2E][FAIL] ${label}`).toBe(true);
  return valueToCheck as unknown[];
}

function filteredApprovalRows(valueToCheck: unknown, label: string): unknown[] {
  const page = jsonObject(valueToCheck, `${label} page wrapper`);
  expect(page).toEqual(expect.objectContaining({
    items: expect.any(Array), page: expect.any(Number), size: expect.any(Number),
    totalElements: expect.any(Number), totalPages: expect.any(Number),
  }));
  return jsonArray(page.items, `${label} items`);
}

function safeJson(payload: Record<string, unknown>): string {
  const serialized = JSON.stringify(payload);
  expect(serialized, "[E2E][FAIL] mutation payload must be serializable").not.toBeUndefined();
  expect(serialized, "[E2E][FAIL] actor identity must come from the authenticated browser token, not the request body")
    .not.toMatch(/"actor(?:_|)id"\s*:/i);
  return serialized;
}

function idempotencyKey(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? `${Date.now()}${Math.random().toString(36).slice(2)}`;
  const key = `${prefix}-${random}`.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 35);
  expect(key, "[E2E][FAIL] generated Idempotency-Key must be non-empty").toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,34}$/);
  return key;
}

function configuredKey(label: string, name: string): string {
  const key = value(name);
  if (!key || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,34}$/.test(key)) {
    block(label, `${name} must match the backend Idempotency-Key contract (1-35 ASCII characters)`);
  }
  return key;
}

async function request(path: string, init: RequestInit = {}, token?: string): Promise<LiveResponse> {
  if (!baseUrl) block("HTTP request", "E2E_API_BASE_URL is absent");
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: Json | undefined;
    if (text) {
      try { body = JSON.parse(text) as Json; } catch { body = text; }
    }
    return { status: response.status, body };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    block("HTTP request", `configured backend ${baseUrl} is unavailable: ${detail}`);
  }
}

async function login(path: string, credentials: Record<string, string>, label: string): Promise<string> {
  const response = await request(path, { method: "POST", body: safeJson(credentials) });
  expectStatus(response, 200, `${label} login`);
  const body = jsonObject(response.body, `${label} login response`);
  expect(body.access_token, `[E2E][FAIL] ${label} must return access_token`).toEqual(expect.any(String));
  expect(body.refresh_token, `[E2E][FAIL] ${label} must return refresh_token`).toEqual(expect.any(String));
  return body.access_token as string;
}

async function employeeToken(employeeIdName: string, passwordName: string, label: string, expectedRole: string): Promise<string> {
  const employeeId = value(employeeIdName)!;
  const token = await login("/api/auth/login", { employee_id: employeeId, password: value(passwordName)! }, label);
  const me = await request("/api/auth/me", undefined, token);
  expectStatus(me, 200, `${label} identity`);
  const identity = jsonObject(me.body, `${label} identity response`);
  expect(identity.employee_id, `[E2E][FAIL] ${label} token principal`).toBe(employeeId);
  expect(identity.role, `[E2E][FAIL] ${label} role`).toBe(expectedRole);
  return token;
}

async function mutation(
  path: string,
  token: string,
  key: string,
  label: string,
  payload?: Record<string, unknown>,
  method: "POST" | "PATCH" = "POST",
): Promise<LiveResponse> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,34}$/.test(key)) {
    block(label, "Idempotency-Key must match the backend 1-35 character header contract");
  }
  return request(path, {
    method,
    headers: { "Idempotency-Key": key },
    ...(payload === undefined ? {} : { body: safeJson(payload) }),
  }, token);
}

function assertActor(response: LiveResponse, field: string, actor: string, label: string): Record<string, unknown> {
  const body = jsonObject(response.body, `${label} response`);
  expect(body[field], `[E2E][FAIL] ${label} actor field`).toBe(actor);
  return body;
}

describe("live backend E2E contract proof", () => {
  liveTest("anonymous public rooms and services", false, ["E2E_API_BASE_URL"], async () => {
    const rooms = await request("/api/public/rooms");
    const services = await request("/api/public/services");
    expectStatus(rooms, 200, "anonymous public rooms");
    expectStatus(services, 200, "anonymous public services");
    const roomRows = jsonArray(rooms.body, "public rooms");
    const serviceRows = jsonArray(services.body, "public services");
    for (const room of roomRows) {
      expect(jsonObject(room, "public room")).toEqual(expect.objectContaining({
        room_id: expect.any(String), room_name: expect.any(String), daily_price: expect.anything(), status: expect.any(String),
      }));
    }
    for (const service of serviceRows) {
      expect(jsonObject(service, "public service")).toEqual(expect.objectContaining({
        service_id: expect.any(String), name: expect.any(String), price: expect.anything(), unit: expect.any(String),
      }));
    }
  });

  liveTest("customer register, login, booking, deposit instruction, and ownership", true, [
    "E2E_API_BASE_URL", "E2E_CUSTOMER_PHONE", "E2E_CUSTOMER_PASSWORD", "E2E_CUSTOMER_FULL_NAME",
    "E2E_CUSTOMER_IDENTITY_NUMBER", "E2E_CUSTOMER_ROOM_ID", "E2E_CUSTOMER_CHECK_IN", "E2E_CUSTOMER_CHECK_OUT",
    "E2E_CUSTOMER_FOREIGN_RESERVATION_ID",
  ], async () => {
    const label = "customer booking";
    const registration = await request("/api/auth/customers/register", {
      method: "POST",
      body: safeJson({
        phone: value("E2E_CUSTOMER_PHONE")!, password: value("E2E_CUSTOMER_PASSWORD")!,
        full_name: value("E2E_CUSTOMER_FULL_NAME")!, identity_number: value("E2E_CUSTOMER_IDENTITY_NUMBER")!,
      }),
    });
    expectStatus(registration, 201, "customer registration");
    const account = jsonObject(registration.body, "customer registration response");
    expect(account.id, "customer account id").toEqual(expect.any(Number));
    expect(account.guest_id, "customer guest id").toEqual(expect.any(Number));

    const token = await login("/api/auth/customers/login", {
      phone: value("E2E_CUSTOMER_PHONE")!, password: value("E2E_CUSTOMER_PASSWORD")!,
    }, "customer");
    const me = await request("/api/auth/customers/me", undefined, token);
    expectStatus(me, 200, "customer identity");
    const customerMe = jsonObject(me.body, "customer identity response");
    expect(jsonObject(customerMe.account, "customer account").id).toBe(account.id);
    expect(jsonObject(customerMe.guest, "customer guest").id).toBe(account.guest_id);

    const bookingBody = {
      rental_type: "PACKAGE",
      rooms: [{ room_id: value("E2E_CUSTOMER_ROOM_ID")!, expected_check_in: localDateTime(label, "E2E_CUSTOMER_CHECK_IN"), expected_check_out: localDateTime(label, "E2E_CUSTOMER_CHECK_OUT") }],
      idempotency_key: `customer-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    };
    const created = await request("/api/customer/reservations", { method: "POST", body: safeJson(bookingBody) }, token);
    expectStatus(created, 201, "customer booking creation");
    const reservation = jsonObject(created.body, "customer booking response");
    expect(reservation.id, "customer booking id").toEqual(expect.any(Number));
    expect(reservation.status).toBe("DRAFT");
    const deposit = jsonObject(reservation.deposit_payment, "customer deposit instruction");
    expect(deposit.status).toBe("PENDING");
    expect(deposit.payment_code).toEqual(expect.any(String));
    expect(Number(deposit.amount)).toBeGreaterThan(0);

    const replay = await request("/api/customer/reservations", { method: "POST", body: safeJson(bookingBody) }, token);
    expectStatus(replay, 201, "customer booking idempotent replay");
    expect(jsonObject(replay.body, "customer booking replay").id).toBe(reservation.id);
    const own = await request(`/api/customer/reservations/${reservation.id as number}`, undefined, token);
    expectStatus(own, 200, "customer owns created reservation");
    expect(jsonObject(own.body, "owned reservation").id).toBe(reservation.id);
    const list = await request("/api/customer/reservations", undefined, token);
    expectStatus(list, 200, "customer reservation list");
    expect(jsonArray(list.body, "customer reservation list").some(item => jsonObject(item).id === reservation.id)).toBe(true);

    const foreign = await request(`/api/customer/reservations/${positiveInteger(label, "E2E_CUSTOMER_FOREIGN_RESERVATION_ID")}`, undefined, token);
    expectStatus(foreign, 422, "customer cannot read another customer's reservation");
    expect(jsonObject(foreign.body, "foreign reservation denial").code).toBe("RESERVATION_NOT_FOUND");
    const anonymous = await request(`/api/customer/reservations/${reservation.id as number}`);
    expectStatus(anonymous, 401, "anonymous cannot read customer reservation");
  });

  liveTest("Front Desk check-in, checkout, payment, and receipt", true, [
    "E2E_API_BASE_URL", "E2E_FRONT_DESK_EMPLOYEE_ID", "E2E_FRONT_DESK_PASSWORD", "E2E_FRONT_DESK_RESERVATION_ID",
    "E2E_FRONT_DESK_CHECK_IN_AT", "E2E_FRONT_DESK_CHECK_OUT_AT",
  ], async () => {
    const label = "Front Desk checkout";
    const employeeId = value("E2E_FRONT_DESK_EMPLOYEE_ID")!;
    const token = await employeeToken("E2E_FRONT_DESK_EMPLOYEE_ID", "E2E_FRONT_DESK_PASSWORD", label, "FRONT_DESK");
    const reservationId = positiveInteger(label, "E2E_FRONT_DESK_RESERVATION_ID");
    const checkInKey = idempotencyKey("fd-in");
    const checkIn = await mutation(`/api/reservations/${reservationId}/check-in`, token, checkInKey, "Front Desk check-in", {
      at: localDateTime(label, "E2E_FRONT_DESK_CHECK_IN_AT"),
    });
    expectStatus(checkIn, 200, "Front Desk check-in");
    expect(jsonObject(checkIn.body, "Front Desk check-in response").status).toBe("CHECKED_IN");

    const checkoutBody = { at: localDateTime(label, "E2E_FRONT_DESK_CHECK_OUT_AT"), payment_method: "CASH" };
    const checkoutKey = idempotencyKey("fd-out");
    const checkout = await mutation(`/api/reservations/${reservationId}/check-out`, token, checkoutKey, "Front Desk checkout", checkoutBody);
    expectStatus(checkout, 200, "Front Desk checkout");
    const invoice = jsonObject(checkout.body, "Front Desk checkout invoice");
    const invoiceId = Number(invoice.id);
    if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) block(label, "checkout did not return a positive invoice id");
    const payable = Number(invoice.payable);
    if (!Number.isFinite(payable) || payable <= 0) block(label, "checkout fixture must return a positive payable amount for payment proof");

    const replayCheckout = await mutation(`/api/reservations/${reservationId}/check-out`, token, checkoutKey, "Front Desk checkout replay", checkoutBody);
    expectStatus(replayCheckout, 200, "Front Desk checkout idempotent replay");
    expect(jsonObject(replayCheckout.body, "Front Desk checkout replay").id).toBe(invoice.id);
    const repeatedCheckout = await mutation(`/api/reservations/${reservationId}/check-out`, token, idempotencyKey("fd-repeat"), "Front Desk repeated checkout", checkoutBody);
    expectStatus(repeatedCheckout, [409, 422], "Front Desk repeated checkout is rejected");

    const paymentKey = idempotencyKey("fd-pay");
    const paymentBody = { amount: payable, method: "CASH", type: "PAYMENT", reference: `E2E-FD-${invoiceId}` };
    const payment = await mutation(`/api/invoices/${invoiceId}/payments`, token, paymentKey, "Front Desk payment", paymentBody);
    expectStatus(payment, 200, "Front Desk payment");
    const paymentResponse = assertActor(payment, "actor_id", employeeId, "Front Desk payment");
    expect(paymentResponse.invoice_id).toBe(invoiceId);
    expect(paymentResponse.type).toBe("PAYMENT");
    const paymentReplay = await mutation(`/api/invoices/${invoiceId}/payments`, token, paymentKey, "Front Desk payment replay", paymentBody);
    expectStatus(paymentReplay, 200, "Front Desk payment idempotent replay");
    expect(jsonObject(paymentReplay.body, "Front Desk payment replay").id).toBe(paymentResponse.id);

    const receiptKey = idempotencyKey("fd-rec");
    const receipt = await mutation(`/api/invoices/${invoiceId}/receipts`, token, receiptKey, "Front Desk receipt", {
      receipt_number: `E2E-FD-RECEIPT-${invoiceId}-${Date.now()}`,
      amount: payable,
      method: "CASH",
    });
    expectStatus(receipt, 200, "Front Desk receipt");
    const receiptResponse = assertActor(receipt, "issued_by", employeeId, "Front Desk receipt");
    expect(receiptResponse.invoice_id).toBe(invoiceId);

    const checkedOut = await request(`/api/reservations/${reservationId}`, undefined, token);
    expectStatus(checkedOut, 200, "Front Desk backend checkout state");
    expect(jsonObject(checkedOut.body, "checked out reservation").status).toBe("CHECKED_OUT");
  });

  liveTest("Housekeeping handoff, Technical completion, and Manager release", true, [
    "E2E_API_BASE_URL", "E2E_HOUSEKEEPING_EMPLOYEE_ID", "E2E_HOUSEKEEPING_PASSWORD", "E2E_TECHNICAL_EMPLOYEE_ID",
    "E2E_TECHNICAL_PASSWORD", "E2E_MANAGER_EMPLOYEE_ID", "E2E_MANAGER_PASSWORD", "E2E_WORK_ORDER_ID", "E2E_WORK_ORDER_ROOM_ID",
  ], async () => {
    const label = "housekeeping -> technical -> manager release";
    distinct(label, "E2E_HOUSEKEEPING_EMPLOYEE_ID", "E2E_TECHNICAL_EMPLOYEE_ID");
    distinct(label, "E2E_TECHNICAL_EMPLOYEE_ID", "E2E_MANAGER_EMPLOYEE_ID");
    const housekeepingToken = await employeeToken("E2E_HOUSEKEEPING_EMPLOYEE_ID", "E2E_HOUSEKEEPING_PASSWORD", label, "HOUSEKEEPING");
    const roomId = value("E2E_WORK_ORDER_ROOM_ID")!;
    const tasks = await request(`/api/operations/housekeeping/tasks?roomId=${encodeURIComponent(roomId)}`, undefined, housekeepingToken);
    expectStatus(tasks, 200, "housekeeping readiness read");
    const task = jsonArray(tasks.body, "housekeeping tasks").find(item => {
      const row = jsonObject(item);
      return row.room_id === roomId;
    });
    expect(task, "[E2E][FAIL] configured work-order room must have a housekeeping handoff").toBeDefined();
    const taskRow = jsonObject(task, "housekeeping handoff");
    expect(taskRow.status).toBe("WAITING_TECHNICAL");
    expect(taskRow.checklist_complete).toBe(true);
    expect(taskRow.blocking_incident).toBe(false);

    const technicalToken = await employeeToken("E2E_TECHNICAL_EMPLOYEE_ID", "E2E_TECHNICAL_PASSWORD", label, "TECHNICAL");
    const workOrderId = positiveInteger(label, "E2E_WORK_ORDER_ID");
    const workOrders = await request(`/api/operations/technical/work-orders?roomId=${encodeURIComponent(roomId)}`, undefined, technicalToken);
    expectStatus(workOrders, 200, "technical work-order read");
    const fixture = jsonArray(workOrders.body, "technical work orders").find(item => jsonObject(item).id === workOrderId);
    expect(fixture, "[E2E][FAIL] configured work-order id must belong to the configured room").toBeDefined();
    expect(jsonObject(fixture, "technical work-order fixture").status).toBe("NEW");

    const acknowledged = await mutation(`/api/operations/technical/work-orders/${workOrderId}`, technicalToken, idempotencyKey("tech-ack"), "technical acknowledge", { status: "ACKNOWLEDGED" }, "PATCH");
    expectStatus(acknowledged, 200, "technical acknowledge");
    expect(jsonObject(acknowledged.body).status).toBe("ACKNOWLEDGED");
    const inProgress = await mutation(`/api/operations/technical/work-orders/${workOrderId}`, technicalToken, idempotencyKey("tech-work"), "technical start", { status: "IN_PROGRESS" }, "PATCH");
    expectStatus(inProgress, 200, "technical start");
    expect(jsonObject(inProgress.body).status).toBe("IN_PROGRESS");
    const waiting = await mutation(`/api/operations/technical/work-orders/${workOrderId}`, technicalToken, idempotencyKey("tech-wait"), "technical completion handoff", {
      status: "WAITING_ACCEPTANCE", result_note: "E2E technical repair completed",
    }, "PATCH");
    expectStatus(waiting, 200, "technical completion handoff");
    expect(jsonObject(waiting.body).status).toBe("WAITING_ACCEPTANCE");

    // 1. Technical attempting self-acceptance must receive 403 Forbidden
    const technicalAcceptForbidden = await mutation(`/api/operations/technical/work-orders/${workOrderId}/accept`, technicalToken, idempotencyKey("tech-acc-forbidden"), "technical self-acceptance attempt", {
      acceptance_note: "Technical self-accept attempt",
    });
    expectStatus(technicalAcceptForbidden, 403, "technical self-acceptance must be forbidden");

    // 2. Manager/Director must call acceptance with acceptance_note
    const managerId = value("E2E_MANAGER_EMPLOYEE_ID")!;
    const managerToken = await employeeToken("E2E_MANAGER_EMPLOYEE_ID", "E2E_MANAGER_PASSWORD", label, "MANAGER");
    const accepted = await mutation(`/api/operations/technical/work-orders/${workOrderId}/accept`, managerToken, idempotencyKey("mgr-acc"), "manager technical acceptance", {
      acceptance_note: "E2E manager acceptance",
    });
    expectStatus(accepted, 200, "manager technical acceptance");
    const acceptedRow = jsonObject(accepted.body, "manager acceptance response");
    expect(acceptedRow.status).toBe("COMPLETED");
    expect(acceptedRow.accepted_by).toBe(managerId);

    // 3. Manager attempting room release must receive 403 Forbidden (segregation of duties)
    const managerReleaseForbidden = await mutation(`/api/operations/technical/work-orders/${workOrderId}/release`, managerToken, idempotencyKey("mgr-rel-forbidden"), "manager room release attempt");
    expectStatus(managerReleaseForbidden, 422, "manager room release must be forbidden");
    expect(jsonObject(managerReleaseForbidden.body, "manager release denial").code).toBe("TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN");

    // 4. Assigned Technical actor calls release using technicalToken
    const released = await mutation(`/api/operations/technical/work-orders/${workOrderId}/release`, technicalToken, idempotencyKey("tech-rel"), "technical room release");
    expectStatus(released, 200, "technical room release");
    expect(jsonObject(released.body, "technical release response").status).toBe("ROOM_RELEASED");
    const rooms = await request("/api/rooms?status=available", undefined, managerToken);
    expectStatus(rooms, 200, "released room backend state");
    const releasedRoom = jsonArray(rooms.body, "released rooms").find(item => jsonObject(item).id === roomId);
    expect(releasedRoom, "[E2E][FAIL] released room must be returned by the backend as available").toBeDefined();
    expect(jsonObject(releasedRoom, "released room").status).toBe("available");
  });

  liveTest("Kitchen inventory and manager price approval/activation", true, [
    "E2E_API_BASE_URL", "E2E_KITCHEN_EMPLOYEE_ID", "E2E_KITCHEN_PASSWORD", "E2E_MANAGER_EMPLOYEE_ID", "E2E_MANAGER_PASSWORD",
    "E2E_SERVICE_ID", "E2E_KITCHEN_STOCK_QUANTITY", "E2E_NEW_SERVICE_PRICE",
  ], async () => {
    const label = "kitchen inventory and price approval";
    distinct(label, "E2E_KITCHEN_EMPLOYEE_ID", "E2E_MANAGER_EMPLOYEE_ID");
    const kitchenId = value("E2E_KITCHEN_EMPLOYEE_ID")!;
    const kitchenToken = await employeeToken("E2E_KITCHEN_EMPLOYEE_ID", "E2E_KITCHEN_PASSWORD", label, "KITCHEN");
    const serviceId = value("E2E_SERVICE_ID")!;
    const quantity = positiveInteger(label, "E2E_KITCHEN_STOCK_QUANTITY");
    const newPrice = positiveNumber(label, "E2E_NEW_SERVICE_PRICE");
    const before = await request(`/api/services/${encodeURIComponent(serviceId)}/inventory-movements`, undefined, kitchenToken);
    expectStatus(before, 200, "kitchen inventory read");
    const beforeRows = jsonArray(before.body, "inventory movements");
    const stock = await mutation(`/api/services/${encodeURIComponent(serviceId)}/stock`, kitchenToken, idempotencyKey("kit-stock"), "kitchen stock receipt", { quantity });
    expectStatus(stock, 200, "kitchen stock receipt");
    const stockRow = jsonObject(stock.body, "kitchen stock response");
    expect(stockRow.id).toBe(serviceId);
    expect(Number(stockRow.stock)).toBeGreaterThanOrEqual(quantity);
    const after = await request(`/api/services/${encodeURIComponent(serviceId)}/inventory-movements`, undefined, kitchenToken);
    expectStatus(after, 200, "kitchen inventory outcome");
    const movement = jsonArray(after.body, "inventory outcome movements").find(item => {
      const row = jsonObject(item);
      return Number(row.quantity) === quantity && row.type === "RECEIVE" && row.actor_id === kitchenId
        && !beforeRows.some(previous => jsonObject(previous).id === row.id);
    });
    expect(movement, "[E2E][FAIL] stock mutation must create a RECEIVE movement owned by the authenticated kitchen actor").toBeDefined();

    const submitted = await mutation(`/api/services/${encodeURIComponent(serviceId)}/price/submit`, kitchenToken, idempotencyKey("kit-price"), "kitchen price submission", {
      price: newPrice, reason: "E2E manager price review",
    });
    expectStatus(submitted, 200, "kitchen price submission");
    const approval = jsonObject(submitted.body, "price approval response");
    const approvalId = Number(approval.id);
    if (!Number.isSafeInteger(approvalId) || approvalId <= 0) block(label, "price submission did not return a positive approval id");
    expect(approval.action).toBe("SERVICE_PRICE_CHANGE");
    expect(approval.target_id).toBe(serviceId);
    expect(approval.requester).toBe(kitchenId);
    expect(approval.status).toBe("PENDING");

    const managerToken = await employeeToken("E2E_MANAGER_EMPLOYEE_ID", "E2E_MANAGER_PASSWORD", label, "MANAGER");
    const approved = await mutation(`/api/governance/approvals/${approvalId}/approve`, managerToken, idempotencyKey("kit-appr"), "manager price approval");
    expectStatus(approved, 200, "manager price approval");
    const approvedRow = jsonObject(approved.body, "manager price approval response");
    expect(approvedRow.status).toBe("APPROVED");
    expect(approvedRow.approver).toBe(value("E2E_MANAGER_EMPLOYEE_ID"));
    const activated = await mutation(`/api/services/${encodeURIComponent(serviceId)}/price/activate`, managerToken, idempotencyKey("kit-act"), "manager price activation", {
      price: newPrice, reason: "E2E manager price review",
    });
    expectStatus(activated, 200, "manager price activation");
    expect(Number(jsonObject(activated.body, "manager price activation response").price)).toBe(newPrice);
  });

  liveTest("Accounting payment and refund contract blocker", true, [
    "E2E_API_BASE_URL", "E2E_ACCOUNTING_EMPLOYEE_ID", "E2E_ACCOUNTING_PASSWORD", "E2E_ACCOUNTING_INVOICE_ID",
    "E2E_ACCOUNTING_PAYMENT_AMOUNT", "E2E_ACCOUNTING_REFUND_AMOUNT",
  ], async () => {
    const label = "accounting payment/refund";
    distinct(label, "E2E_ACCOUNTING_EMPLOYEE_ID", "E2E_DIRECTOR_EMPLOYEE_ID");
    const accountingId = value("E2E_ACCOUNTING_EMPLOYEE_ID")!;
    const invoiceId = positiveInteger(label, "E2E_ACCOUNTING_INVOICE_ID");
    const paymentAmount = positiveNumber(label, "E2E_ACCOUNTING_PAYMENT_AMOUNT");
    const refundAmount = positiveNumber(label, "E2E_ACCOUNTING_REFUND_AMOUNT");
    if (refundAmount > paymentAmount) block(label, "E2E_ACCOUNTING_REFUND_AMOUNT cannot exceed the new payment amount");
    const accountingToken = await employeeToken("E2E_ACCOUNTING_EMPLOYEE_ID", "E2E_ACCOUNTING_PASSWORD", label, "ACCOUNTING");
    const payment = await mutation(`/api/invoices/${invoiceId}/payments`, accountingToken, idempotencyKey("acct-pay"), "accounting payment", {
      amount: paymentAmount, method: "CASH", type: "PAYMENT", reference: `E2E-ACCOUNTING-${invoiceId}`,
    });
    expectStatus(payment, 200, "accounting payment");
    const paymentRow = assertActor(payment, "actor_id", accountingId, "accounting payment");
    expect(paymentRow.type).toBe("PAYMENT");
    expect(Number(paymentRow.amount)).toBe(paymentAmount);

    const unapproved = await mutation(`/api/invoices/${invoiceId}/payments`, accountingToken, idempotencyKey("acct-no"), "accounting unapproved refund", {
      amount: refundAmount, method: "CASH", type: "REFUND", reference: "E2E-ACCOUNTING-REFUND",
    });
    expectStatus(unapproved, 422, "accounting refund remains blocked without approval binding");
    expect(jsonObject(unapproved.body, "unapproved refund response").code).toBe("APPROVAL_REQUIRED");
  });

  liveTest("HR/Admin permission ceiling", false, [
    "E2E_API_BASE_URL", "E2E_ADMIN_EMPLOYEE_ID", "E2E_ADMIN_PASSWORD", "E2E_HR_EMPLOYEE_ID", "E2E_HR_PASSWORD",
  ], async () => {
    const label = "HR/Admin permission ceiling";
    distinct(label, "E2E_ADMIN_EMPLOYEE_ID", "E2E_HR_EMPLOYEE_ID");
    const adminToken = await employeeToken("E2E_ADMIN_EMPLOYEE_ID", "E2E_ADMIN_PASSWORD", label, "ADMIN");
    const hrToken = await employeeToken("E2E_HR_EMPLOYEE_ID", "E2E_HR_PASSWORD", label, "HR");
    const adminEmployees = await request("/api/auth/employees", undefined, adminToken);
    expectStatus(adminEmployees, 200, "admin employee administration");
    expect(jsonArray(adminEmployees.body, "admin employee list").length).toBeGreaterThan(0);
    const hrEmployees = await request("/api/auth/employees", undefined, hrToken);
    expectStatus(hrEmployees, 200, "HR employee-read access");
    const provision = await request("/api/auth/employees/auto-provision", {
      method: "POST",
      body: safeJson({
        full_name: "E2E HR Provision Must Be Blocked", role: "STAFF",
        phone: "0999888777", email: "hr-provision-blocked@example.invalid", address: "E2E",
      }),
    }, hrToken);
    expectStatus(provision, 403, "HR cannot provision employee accounts");
    const hrShifts = await request("/api/hr/shifts", undefined, hrToken);
    expectStatus(hrShifts, 200, "HR retains HR read access");
  });

  afterAll(() => {
    console.info(`[E2E][SUMMARY] configured=${configuredScenarios} skipped=${skippedScenarios} blocked=${blockedScenarios}; skipped scenarios are not verified`);
  });
});
