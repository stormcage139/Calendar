// Vite forwards same-origin /api requests to the backend in development.
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function request(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "Сервер недоступен. Проверьте соединение и попробуйте ещё раз.",
    );
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("Неверный логин или пароль.");
    if (response.status === 409)
      throw new Error("Этот логин или email уже занят.");
    if (response.status === 422)
      throw new Error("Проверьте введённые данные: сервер не смог их принять.");
    if (response.status === 429)
      throw new Error("Слишком много попыток. Попробуйте немного позже.");
    throw new Error("Не удалось выполнить запрос. Попробуйте позже.");
  }
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Сервер вернул неожиданный ответ. Попробуйте позже.");
  }
}

export async function login(username: string, password: string): Promise<void> {
  const data = await request("/token_test", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (
    !data ||
    typeof data !== "object" ||
    !("access_token" in data) ||
    typeof data.access_token !== "string" ||
    !data.access_token
  ) {
    throw new Error("Сервер не вернул токен авторизации. Попробуйте позже.");
  }
  sessionStorage.setItem("calendar_access_token", data.access_token);
}

export async function register(data: {
  login: string;
  email: string;
  password: string;
}): Promise<void> {
  await request("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
