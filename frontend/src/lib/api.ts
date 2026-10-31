import { clearSession, getToken } from "./session";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const UNAUTHORIZED_EVENT = "khatagst:unauthorized";

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as ApiRecord;
}

export function getApiErrorMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  if (!record) return fallback;

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  const errorRecord = asRecord(record.error);
  if (
    errorRecord &&
    typeof errorRecord.message === "string" &&
    errorRecord.message.trim()
  ) {
    return errorRecord.message;
  }

  const dataRecord = asRecord(record.data);
  if (
    dataRecord &&
    typeof dataRecord.message === "string" &&
    dataRecord.message.trim()
  ) {
    return dataRecord.message;
  }

  return fallback;
}

function handleUnauthorized(status: number) {
  if (status !== 401) return;
  clearSession();
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  handleUnauthorized(response.status);
  return response;
}

export async function apiJson<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(path, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "Request fail ho gaya."));
  }
  return payload as T;
}
