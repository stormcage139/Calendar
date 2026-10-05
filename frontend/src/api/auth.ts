import { ApiError, invalidResponse, isObject, request, saveToken } from "./client.ts";

export type User = { id: number; login: string; email: string };

export function readUser(data: unknown): User {
  if (!isObject(data) || !Number.isSafeInteger(data.id) ||
      typeof data.login !== "string" || typeof data.email !== "string") {
    return invalidResponse();
  }
  return { id: data.id as number, login: data.login, email: data.email };
}

export async function getCurrentUser(signal?: AbortSignal): Promise<User> {
  return readUser(await request("/users/me/", { signal }));
}

export async function login(username: string, password: string): Promise<void> {
  const data = await request("/token_test", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  }, false);
  if (!isObject(data) || typeof data.access_token !== "string" || !data.access_token ||
      typeof data.token_type !== "string" || data.token_type.toLowerCase() !== "bearer") {
    throw new ApiError("Сервер не вернул корректный токен авторизации.");
  }
  saveToken(data.access_token);
}

export async function register(data: {
  login: string;
  email: string;
  password: string;
}): Promise<void> {
  try {
    const result = await request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }, false);
    // The existing endpoint returns a JSON string, not a user object.
    if (typeof result !== "string" || !result.startsWith("user created ")) invalidResponse();
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) {
      throw new ApiError("Этот логин или email уже занят.", 409);
    }
    throw cause;
  }
}
