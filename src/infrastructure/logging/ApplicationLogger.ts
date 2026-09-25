type LogDetails = Record<string, unknown>;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  return { errorMessage: String(error) };
};

const entry = (level: "info" | "error", event: string, details: LogDetails = {}) =>
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  });

export const logInfo = (event: string, details?: LogDetails) => {
  console.log(entry("info", event, details));
};

export const logError = (event: string, error: unknown, details?: LogDetails) => {
  console.error(entry("error", event, { ...details, ...serializeError(error) }));
};
