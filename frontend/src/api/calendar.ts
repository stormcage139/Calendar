import { readUser } from "./auth.ts";
import type { User } from "./auth.ts";
import { ApiError, invalidResponse, isObject, request } from "./client.ts";

export type EventStatus = "collecting" | "voting" | "completed" | "cancelled";

export type CalendarEvent = {
  id: number;
  name: string;
  online: boolean;
  // Voting deadline; UTC with "Z" from the current backend.
  deadline: string;
  description?: string | null;
  status?: EventStatus;
  creator_id?: number;
  // Chosen date of a completed event.
  final_start?: string | null;
  final_end?: string | null;
};

export type EventMember = { user_id: number; login: string; status: "invited" | "joined" };

export type EventDetail = CalendarEvent & {
  creator_login: string;
  members: EventMember[];
  my_status: "creator" | "invited" | "joined";
  // The deadline passed with a tie: the creator has to pick the winner.
  awaiting_creator: boolean;
};

export type DateOption = {
  id: number;
  start: string;
  end: string;
  author_id: number;
  author_login: string;
  votes: number;
  voters: string[];
  voted_by_me: boolean;
};

export type VoteResults = {
  status: EventStatus;
  options: DateOption[];
  leaders: number[];
  is_tie: boolean;
  voters_count: number;
  members_count: number;
  final: DateOption | null;
  resolved_by: "votes" | "creator" | "deadline" | null;
};

export type FriendRequest = {
  friend_id: number;
  // Login of the other user; null when the backend doesn't send it.
  login: string | null;
  type: "incoming" | "outgoing";
  accepted_date: string | null;
};

function readEvent(event: unknown): CalendarEvent {
  if (!isObject(event) || !Number.isSafeInteger(event.id) || (event.id as number) <= 0 ||
      typeof event.name !== "string" || typeof event.online !== "boolean" ||
      typeof event.deadline !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(event.deadline) ||
      Number.isNaN(Date.parse(event.deadline))) return invalidResponse();
  const result: CalendarEvent = { id: event.id as number, name: event.name, online: event.online, deadline: event.deadline };
  // Newer fields are optional so older responses still parse.
  if (event.description === null || typeof event.description === "string") result.description = event.description;
  if (isStatus(event.status)) result.status = event.status;
  if (Number.isSafeInteger(event.creator_id)) result.creator_id = event.creator_id as number;
  if (event.final_start === null || isDate(event.final_start)) result.final_start = event.final_start as string | null;
  if (event.final_end === null || isDate(event.final_end)) result.final_end = event.final_end as string | null;
  return result;
}

function isStatus(value: unknown): value is EventStatus {
  return value === "collecting" || value === "voting" || value === "completed" || value === "cancelled";
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function readEventDetail(data: unknown): EventDetail {
  const event = readEvent(data);
  if (!isObject(data) || typeof data.creator_login !== "string" || !Array.isArray(data.members) ||
      (data.my_status !== "creator" && data.my_status !== "invited" && data.my_status !== "joined")) {
    return invalidResponse();
  }
  const members = data.members.map((member: unknown): EventMember => {
    if (!isObject(member) || !Number.isSafeInteger(member.user_id) || typeof member.login !== "string" ||
        (member.status !== "invited" && member.status !== "joined")) return invalidResponse();
    return { user_id: member.user_id as number, login: member.login, status: member.status };
  });
  return {
    ...event, creator_login: data.creator_login, members, my_status: data.my_status,
    awaiting_creator: data.awaiting_creator === true,
  };
}

function readOption(data: unknown): DateOption {
  if (!isObject(data) || !Number.isSafeInteger(data.id) || !isDate(data.start) || !isDate(data.end) ||
      !Number.isSafeInteger(data.author_id) || typeof data.author_login !== "string" ||
      !Number.isSafeInteger(data.votes) || !Array.isArray(data.voters) ||
      !data.voters.every((voter) => typeof voter === "string") || typeof data.voted_by_me !== "boolean") {
    return invalidResponse();
  }
  return {
    id: data.id as number, start: data.start, end: data.end, author_id: data.author_id as number,
    author_login: data.author_login, votes: data.votes as number, voters: data.voters as string[],
    voted_by_me: data.voted_by_me,
  };
}

function readOptions(data: unknown): DateOption[] {
  if (!Array.isArray(data)) return invalidResponse();
  return data.map(readOption);
}

function readResults(data: unknown): VoteResults {
  if (!isObject(data) || !isStatus(data.status) || !Array.isArray(data.leaders) ||
      !data.leaders.every((id) => Number.isSafeInteger(id)) || typeof data.is_tie !== "boolean" ||
      !Number.isSafeInteger(data.voters_count) || !Number.isSafeInteger(data.members_count) ||
      !(data.resolved_by === null || data.resolved_by === "votes" || data.resolved_by === "creator" || data.resolved_by === "deadline")) {
    return invalidResponse();
  }
  return {
    status: data.status, options: readOptions(data.options), leaders: data.leaders as number[],
    is_tie: data.is_tie, voters_count: data.voters_count as number, members_count: data.members_count as number,
    final: data.final === null || data.final === undefined ? null : readOption(data.final),
    resolved_by: data.resolved_by,
  };
}

const json = { "Content-Type": "application/json" };

// Domain errors from the event endpoints, in place of the generic status messages.
async function eventRequest(path: string, init: RequestInit = {}, notFound = "Событие не найдено или у вас нет к нему доступа."): Promise<unknown> {
  try {
    return await request(path, init);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) throw new ApiError(notFound, 404);
    if (cause instanceof ApiError && cause.status === 403) throw new ApiError("Это действие доступно только организатору или участнику события.", 403);
    if (cause instanceof ApiError && cause.status === 409) throw new ApiError("Действие недоступно на текущем этапе события. Обновите страницу.", 409);
    throw cause;
  }
}

export async function getEvents(signal?: AbortSignal): Promise<CalendarEvent[]> {
  const data = await request("/events/", { signal });
  if (!Array.isArray(data)) return invalidResponse();
  return data.map(readEvent);
}

export async function createEvent(data: {
  name: string;
  online: boolean;
  deadline: string;
  description?: string;
  invite_logins?: string[];
}): Promise<CalendarEvent> {
  return readEvent(await eventRequest("/events/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }, "Пользователь с таким логином не найден."));
}

export async function getEvent(id: number, signal?: AbortSignal): Promise<EventDetail> {
  return readEventDetail(await eventRequest(`/events/${id}`, { signal }));
}

export async function updateEvent(id: number, data: {
  name?: string; online?: boolean; deadline?: string; description?: string | null;
}): Promise<EventDetail> {
  return readEventDetail(await eventRequest(`/events/${id}`, { method: "PATCH", headers: json, body: JSON.stringify(data) }));
}

export async function cancelEvent(id: number): Promise<EventDetail> {
  return readEventDetail(await eventRequest(`/events/${id}/cancel`, { method: "POST" }));
}

export async function inviteToEvent(id: number, logins: string[]): Promise<EventDetail> {
  return readEventDetail(await eventRequest(`/events/${id}/invite`, {
    method: "POST", headers: json, body: JSON.stringify({ logins }),
  }, "Пользователь с таким логином не найден."));
}

export async function acceptInvite(id: number): Promise<EventDetail> {
  return readEventDetail(await eventRequest(`/events/${id}/accept`, { method: "POST" }));
}

export async function declineInvite(id: number): Promise<void> {
  if (await eventRequest(`/events/${id}/decline`, { method: "POST" }) !== true) invalidResponse();
}

export async function getOptions(id: number, signal?: AbortSignal): Promise<DateOption[]> {
  return readOptions(await eventRequest(`/events/${id}/options`, { signal }));
}

export async function addOption(id: number, start: string, end: string): Promise<DateOption> {
  try {
    return readOption(await eventRequest(`/events/${id}/options`, {
      method: "POST", headers: json, body: JSON.stringify({ start, end }),
    }));
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) throw new ApiError("Такой вариант уже предложен или сбор вариантов закончен.", 409);
    if (cause instanceof ApiError && cause.status === 422) throw new ApiError("Начало должно быть в будущем, а конец — позже начала.", 422);
    throw cause;
  }
}

export async function deleteOption(id: number, optionId: number): Promise<void> {
  if (await eventRequest(`/events/${id}/options/${optionId}`, { method: "DELETE" }) !== true) invalidResponse();
}

export async function startVoting(id: number): Promise<CalendarEvent> {
  return readEvent(await eventRequest(`/events/${id}/start-voting`, { method: "POST" }));
}

export async function setVotes(id: number, optionIds: number[]): Promise<DateOption[]> {
  return readOptions(await eventRequest(`/events/${id}/votes`, {
    method: "PUT", headers: json, body: JSON.stringify({ date_option_ids: optionIds }),
  }));
}

export async function getResults(id: number, signal?: AbortSignal): Promise<VoteResults> {
  return readResults(await eventRequest(`/events/${id}/results`, { signal }));
}

// On a tie the creator passes one of the leaders' ids.
export async function closeVoting(id: number, optionId?: number): Promise<VoteResults> {
  try {
    return readResults(await eventRequest(`/events/${id}/close`, {
      method: "POST", headers: json, body: JSON.stringify({ date_option_id: optionId ?? null }),
    }));
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) throw new ApiError("Ничья: выберите один из лидирующих вариантов.", 409);
    throw cause;
  }
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
    if (!isObject(item) || !Number.isSafeInteger(item.new_freind_id) || (item.new_freind_id as number) <= 0 ||
        (item.type !== "incoming" && item.type !== "outgoing") ||
        !(item.accepted_date === null || (typeof item.accepted_date === "string" && !Number.isNaN(Date.parse(item.accepted_date))))) {
      return invalidResponse();
    }
    // Preserve the backend spelling only at the API boundary.
    return {
      friend_id: item.new_freind_id as number, login: typeof item.login === "string" ? item.login : null,
      type: item.type, accepted_date: item.accepted_date as string | null,
    };
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

export async function sendFriendRequestByLogin(login: string): Promise<void> {
  const name = login.trim().replace(/^@/, "");
  try {
    const result = await request(`/friends/by-login/${encodeURIComponent(name)}`, { method: "POST" });
    if (result === false) throw new ApiError("Запрос не выполнен: заявка уже отправлена.");
    if (result !== true) invalidResponse();
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) throw new ApiError(`Пользователь @${name} не найден.`, 404);
    if (cause instanceof ApiError && cause.status === 400) throw new ApiError("Нельзя добавить себя в друзья.", 400);
    throw cause;
  }
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
