import type { ApiErrorDto, AuthIdentity, TokenResponseDto } from "../types/api";
import { sanitizePayload } from "../utils/encoding";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions extends Omit<RequestInit, "method" | "body" | "headers"> {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  retryOnUnauthorized?: boolean;
  timeoutMs?: number;
}

export type TokenPair = TokenResponseDto;
export type TokenStore = {
  get: () => TokenPair | null;
  set: (tokens: TokenPair) => void;
  clear: () => void;
  getIdentity?: () => AuthIdentity | null;
  setIdentity?: (identity: AuthIdentity) => void;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, payload?: ApiErrorDto, message?: string) {
    super(message ?? payload?.message ?? `API request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code;
    this.details = payload?.details;
  }

  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isConflict() { return this.status === 409; }
  get isValidation() { return this.status === 400 || this.status === 422; }
  get isRateLimited() { return this.status === 429; }
}

/**
 * The Vercel build is a static frontend. It cannot reach a backend listening
 * on the developer machine, and a failed browser fetch otherwise only shows
 * up as a generic "failed to fetch" message. Keep this error structured so
 * callers can still render their normal connection-error state while the
 * console contains the actionable cause.
 */
function apiUnavailableError(baseUrl: string, cause: unknown): ApiError {
  const target = baseUrl || "the current website";
  const causeMessage = cause instanceof Error && cause.message ? ` (${cause.message})` : "";
  return new ApiError(
    0,
    {
      code: "API_UNAVAILABLE",
      message: `Không thể kết nối API tại ${target}. Backend production phải có URL public HTTPS; localhost chỉ dùng cho môi trường local.${causeMessage}`,
    },
  );
}

const defaultStore: TokenStore = {
  get: () => {
    const accessToken = sessionStorage.getItem("hotel_mis_access_token");
    const refreshToken = sessionStorage.getItem("hotel_mis_refresh_token");
    const tokenType = sessionStorage.getItem("hotel_mis_token_type");
    const expiresIn = Number(sessionStorage.getItem("hotel_mis_expires_in"));
    const refreshExpiresIn = Number(sessionStorage.getItem("hotel_mis_refresh_expires_in"));
    return accessToken && refreshToken ? { access_token: accessToken, refresh_token: refreshToken, token_type: tokenType ?? "Bearer", expires_in: expiresIn, refresh_expires_in: refreshExpiresIn } : null;
  },
  set: ({ access_token, refresh_token, token_type, expires_in, refresh_expires_in }) => {
    sessionStorage.setItem("hotel_mis_access_token", access_token);
    sessionStorage.setItem("hotel_mis_refresh_token", refresh_token);
    sessionStorage.setItem("hotel_mis_token_type", token_type);
    sessionStorage.setItem("hotel_mis_expires_in", String(expires_in));
    sessionStorage.setItem("hotel_mis_refresh_expires_in", String(refresh_expires_in));
  },
  clear: () => {
    sessionStorage.removeItem("hotel_mis_access_token");
    sessionStorage.removeItem("hotel_mis_refresh_token");
    sessionStorage.removeItem("hotel_mis_token_type");
    sessionStorage.removeItem("hotel_mis_expires_in");
    sessionStorage.removeItem("hotel_mis_refresh_expires_in");
    sessionStorage.removeItem("hotel_mis_identity");
  },
  getIdentity: () => sessionStorage.getItem("hotel_mis_identity") as AuthIdentity | null,
  setIdentity: identity => sessionStorage.setItem("hotel_mis_identity", identity),
};

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    const json = JSON.parse(text);
    return sanitizePayload(json);
  } catch {
    return { message: sanitizePayload(text) };
  }
}

export class ApiClient {
  private refreshPromise: Promise<TokenPair | null> | null = null;
  readonly baseUrl: string;
  readonly store: TokenStore;

  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? "", store: TokenStore = defaultStore) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.store = store;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { retryOnUnauthorized = true, ...requestOptions } = options;
    const response = await this.execute(path, requestOptions);
    if (response.status === 401 && retryOnUnauthorized && !path.endsWith("/auth/refresh")) {
      const refreshed = await this.refresh();
      if (refreshed) return this.request<T>(path, { ...options, retryOnUnauthorized: false });
    }
    return this.resolve<T>(response);
  }

  async logout(): Promise<void> {
    const tokens = this.store.get();
    try {
      if (tokens) await this.request<void>("/api/auth/logout", { method: "POST", body: { refresh_token: tokens.refresh_token }, retryOnUnauthorized: false });
    } finally { this.store.clear(); }
  }

  private async execute(path: string, options: RequestOptions): Promise<Response> {
    const { method = "GET", body, headers = {}, idempotencyKey, timeoutMs = 10000, ...init } = options;
    const token = this.store.get()?.access_token;
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      try {
        return await fetch(`${this.baseUrl}${path}`, {
          ...init,
          method,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (error) {
        throw apiUnavailableError(this.baseUrl, error);
      }
    } finally { globalThis.clearTimeout(timeout); }
  }

  private async refresh(): Promise<TokenPair | null> {
    if (this.refreshPromise) return this.refreshPromise;
    const current = this.store.get();
    if (!current?.refresh_token) return null;
    this.refreshPromise = (async () => {
      const response = await this.execute("/api/auth/refresh", {
        method: "POST", body: { refresh_token: current.refresh_token }, retryOnUnauthorized: false,
      });
      if (!response.ok) { this.store.clear(); return null; }
      const tokens = await this.resolve<TokenPair>(response);
      this.store.set(tokens);
      return tokens;
    })().catch(() => { this.store.clear(); return null; }).finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  private async resolve<T>(response: Response): Promise<T> {
    const payload = await readPayload(response);
    if (!response.ok) throw new ApiError(response.status, payload as ApiErrorDto | undefined);
    return payload as T;
  }
}

export const apiClient = new ApiClient();
