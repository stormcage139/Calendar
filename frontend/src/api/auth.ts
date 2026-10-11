import { ApiError, invalidResponse, isObject, request, saveToken } from "./client.ts";

export type User = { id: number; login: string; email: string };
export type UserInput = { login: string; email: string; password: string };

export function readUser(data: unknown): User {
  if (!isObject(data) || !Number.isSafeInteger(data.id) || (data.id as number) <= 0 ||
      typeof data.login !== "string" || typeof data.email !== "string") {
    return invalidResponse();
  }
  return { id: data.id as number, login: data.login, email: data.email };
}

export async function getCurrentUser(signal?: AbortSignal): Promise<User> {
  return readUser(await request("/me", { signal }));
}

export async function login(username: string, password: string): Promise<void> {
  const data = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: username, password }),
  }, false);
  if (!isObject(data) || typeof data.access_token !== "string" || !data.access_token ||
      typeof data.token_type !== "string" || data.token_type.toLowerCase() !== "bearer") {
    throw new ApiError("Сервер не вернул корректный токен авторизации.");
  }
  saveToken(data.access_token);
}

export async function register(data: UserInput): Promise<User> {
  try {
    return readUser(await request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }, false));
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) {
      throw new ApiError("Этот логин или email уже занят.", 409);
    }
    throw cause;
  }
}

export async function updateProfile(id: number, data: UserInput): Promise<User> {
  const result = await request(`/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!isObject(result)) return invalidResponse();
  // Pick only public fields: this debug route also returns the password hash.
  return readUser(result.user);
}
