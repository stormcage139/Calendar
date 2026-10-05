const API_URL = (import.meta.env?.VITE_API_URL || "/api").replace(/\/+$/, "");
const TOKEN_KEY = "calendar_access_token";
export const SESSION_EXPIRED_EVENT = "calendar:session-expired";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function hasSession(): boolean {
  return Boolean(sessionStorage.getItem(TOKEN_KEY));
}

export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function request(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (authenticated) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) throw new ApiError("Войдите в аккаунт, чтобы продолжить.", 401);
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ApiError("Сервер недоступен. Проверьте соединение и попробуйте ещё раз.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      if (authenticated) {
        clearSession();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw new ApiError(
        authenticated ? "Сессия истекла. Войдите снова." : "Неверный логин или пароль.",
        401,
      );
    }
    const messages: Record<number, string> = {
      403: "Недостаточно прав для этого действия.",
      404: "Запрошенные данные не найдены.",
      409: "Данные уже существуют или действие конфликтует с текущим состоянием.",
      422: "Проверьте введённые данные: сервер не смог их принять.",
      429: "Слишком много запросов. Попробуйте немного позже.",
      503: "Сервер временно не может выполнить запрос. Попробуйте позже.",
    };
    throw new ApiError(
      messages[response.status] ?? "Не удалось выполнить запрос. Попробуйте позже.",
      response.status,
    );
  }

  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError("Сервер вернул неожиданный формат ответа.");
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function invalidResponse(): never {
  throw new ApiError("Сервер вернул неожиданный формат данных.");
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Не удалось выполнить действие. Попробуйте ещё раз.";
}
