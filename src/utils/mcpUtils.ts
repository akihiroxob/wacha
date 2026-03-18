export const toTextResult = (data: unknown, message?: string) => {
  return {
    content: [
      {
        type: "text" as const,
        text: message ?? JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data as Record<string, unknown>,
  };
};
