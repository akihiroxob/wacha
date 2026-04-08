import { randomUUID } from "node:crypto";

const autoWorkerIdPrefix = "auto";

export const resolveWorkerId = (headerValue?: string | null): string => {
  const trimmed = headerValue?.trim();
  if (trimmed) return trimmed;
  return `${autoWorkerIdPrefix}:${randomUUID()}`;
};

