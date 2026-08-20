// frontend/src/lib/api.ts
// API utility functions — centralized BASE_URL and error handling

// ✅ Uses VITE_API_BASE_URL env var instead of hardcoded value
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

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

/**
 * Authenticated fetch helper — attaches JWT token and handles 401
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("khatagst_token") || "";
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets boundary)
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
}
