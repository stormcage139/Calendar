import { readUser } from "./auth.ts";
import type { User } from "./auth.ts";
import { ApiError, invalidResponse, isObject, request } from "./client.ts";

export type CalendarEvent = {
  id: number;
  name: string;
  online: boolean;
  deadline: string;
};

export type FriendRequest = {
  from_user: number;
  to_user: number;
  accepted_date: string | null;
};

export async function getEvents(signal?: AbortSignal): Promise<CalendarEvent[]> {
  const data = await request("/events/", { signal });
  if (!Array.isArray(data)) return invalidResponse();
  return data.map((event) => {
    if (!isObject(event) || !Number.isSafeInteger(event.id) ||
        typeof event.name !== "string" || typeof event.online !== "boolean" ||
        typeof event.deadline !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(event.deadline) ||
        Number.isNaN(Date.parse(event.deadline))) return invalidResponse();
    return { id: event.id as number, name: event.name, online: event.online, deadline: event.deadline };
  });
}

export async function createEvent(data: {
  name: string;
  online: boolean;
  deadline: string;
}): Promise<void> {
  // POST /events/ returns null; reload GET /events/ after success.
  const result = await request("/events/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (result !== null) invalidResponse();
}

export async function getFriends(signal?: AbortSignal): Promise<User[]> {
  const data = await request("/friends", { signal });
  if (!Array.isArray(data)) return invalidResponse();
  // The backend can repeat users; render each friend once by ID.
  return [...new Map(data.map((item) => {
    const user = readUser(item);
    return [user.id, user] as const;
  })).values()];
}

export async function getFriendRequests(signal?: AbortSignal): Promise<FriendRequest[]> {
  const data = await request("/friends/requests", { signal });
  if (!Array.isArray(data)) return invalidResponse();
  return data.map((item) => {
    if (!isObject(item) || !Number.isSafeInteger(item.from_user) || !Number.isSafeInteger(item.to_user) ||
        !(item.accepted_date === null || (typeof item.accepted_date === "string" && !Number.isNaN(Date.parse(item.accepted_date))))) {
      return invalidResponse();
    }
    return { from_user: item.from_user as number, to_user: item.to_user as number, accepted_date: item.accepted_date as string | null };
  });
}

export async function sendFriendRequest(id: number): Promise<void> {
  const result = await request(`/friends/${id}`, { method: "POST" });
  if (isObject(result) && "error" in result) {
    throw new ApiError("Нельзя добавить себя в друзья.");
  }
  if (result === false) throw new ApiError("Запрос не выполнен: заявка уже существует либо пользователь недоступен.");
  if (result !== true) invalidResponse();
}

export async function removeFriend(id: number): Promise<void> {
  const result = await request(`/friends/${id}`, { method: "DELETE" });
  if (result === false) throw new ApiError("Не удалось удалить друга или заявку. Обновите список и попробуйте снова.");
  if (result !== true) invalidResponse();
}

export async function deleteAccount(id: number): Promise<void> {
  const result = await request(`/users/${id}`, { method: "DELETE" });
  if (!isObject(result) || typeof result.deleted !== "boolean") invalidResponse();
  if (!result.deleted) throw new ApiError("Не удалось удалить аккаунт. Попробуйте позже.");
}

export async function pingServer(): Promise<void> {
  if (await request("/ping", {}, false) !== "pong") invalidResponse();
}
