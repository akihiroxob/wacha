type McpStructuredValue =
  | string
  | number
  | boolean
  | null
  | McpStructuredValue[]
  | { [key: string]: McpStructuredValue };

type McpStructuredRecord = { [key: string]: McpStructuredValue };

const isPlainValue = (value: unknown): value is string | number | boolean | null => {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
};

export const serializeForMcp = (value: unknown): McpStructuredValue => {
  if (isPlainValue(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForMcp(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      serializeForMcp(entryValue),
    ]);

    return Object.fromEntries(entries);
  }

  return String(value);
};

export const toTextResult = (data: unknown, message?: string) => {
  const serialized = serializeForMcp(data);
  const structuredContent: McpStructuredRecord =
    typeof serialized === "object" && serialized !== null && !Array.isArray(serialized)
      ? serialized
      : { result: serialized };

  return {
    content: [
      {
        type: "text" as const,
        text: message ?? JSON.stringify(serialized, null, 2),
      },
    ],
    structuredContent,
  };
};
