export function getApiErrorMessage(payload: any, fallback: string): string {
  if (!payload) return fallback;

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message;
  }

  if (typeof payload.data?.message === "string" && payload.data.message.trim()) {
    return payload.data.message;
  }

  return fallback;
}
