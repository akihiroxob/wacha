export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.error?.message === "string") message = body.error.message;
    } catch {
      // レスポンスがJSONでない場合はstatusTextを使う
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
};

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>(path, jsonInit("POST", body));
export const apiPut = <T>(path: string, body?: unknown) => request<T>(path, jsonInit("PUT", body));
export const apiDelete = <T>(path: string, body?: unknown) =>
  request<T>(path, body === undefined ? { method: "DELETE" } : jsonInit("DELETE", body));
