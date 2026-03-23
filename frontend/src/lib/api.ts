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
