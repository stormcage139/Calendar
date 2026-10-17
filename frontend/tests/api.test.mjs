import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBrowserEnvironment } from "./environment.mjs";
import { getCurrentUser, login, register, updateProfile } from "../src/api/auth.ts";
import { ApiError, hasSession, request, SESSION_EXPIRED_EVENT } from "../src/api/client.ts";
import {
  addOption, closeVoting, createEvent, getEvent, getEvents, getFriendRequests, getFriends, getResults,
  inviteToEvent, removeFriend, sendFriendRequest, sendFriendRequestByLogin, setVotes,
} from "../src/api/calendar.ts";

installBrowserEnvironment();
const originalFetch = globalThis.fetch;
afterEach(() => { sessionStorage.clear(); globalThis.fetch = originalFetch; });

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

test("login submits JSON and uses token_type; protected requests send Bearer", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/login");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.get("Content-Type"), "application/json");
    assert.equal(init.headers.has("Authorization"), false);
    assert.deepEqual(JSON.parse(init.body), { login: "логин +&", password: "pass +&=" });
    return respond({ access_token: "test-token", token_type: "bearer" });
  };
  await login("логин +&", "pass +&=");
  assert.equal(hasSession(), true);
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/me");
    assert.equal(init.headers.get("Authorization"), "Bearer test-token");
    return respond({ id: 1, login: "hello", email: "hello@example.com" });
  };
  assert.equal((await getCurrentUser()).id, 1);
});

test("missing or incompatible token never creates a session", async () => {
  for (const data of [{ access_token: "x" }, { access_token: "", token_type: "bearer" }, { access_token: "x", token_type: "Basic" }]) {
    globalThis.fetch = async () => respond(data);
    await assert.rejects(login("a", "b"), /токен/);
    assert.equal(hasSession(), false);
  }
});

test("registration reads the public user and sends unchanged JSON fields", async () => {
  const data = { login: "hello", email: "hello@example.com", password: "password" };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/register");
    assert.deepEqual(JSON.parse(init.body), data);
    return respond({ id: 1, login: data.login, email: data.email });
  };
  assert.deepEqual(await register(data), { id: 1, login: data.login, email: data.email });
  assert.equal(hasSession(), false);
});

test("expired sessions are cleared and announced; wrong password does not expire another session", async () => {
  sessionStorage.setItem("calendar_access_token", "expired");
  let expired = 0;
  window.addEventListener(SESSION_EXPIRED_EVENT, () => expired++);
  globalThis.fetch = async () => respond({ detail: "Could not validate credentials" }, 401);
  await assert.rejects(getCurrentUser(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(hasSession(), false);
  assert.equal(expired, 1);
  await assert.rejects(login("wrong", "wrong"), /Неверный логин/);
  assert.equal(expired, 1);
});

test("event creation returns the created event; list requires a structured deadline", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const data = { name: "Meeting", online: true, deadline: "2026-10-15T00:00:00" };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/events/");
    assert.deepEqual(JSON.parse(init.body), data);
    return respond({ id: 1, ...data });
  };
  assert.deepEqual(await createEvent(data), { id: 1, ...data });
  globalThis.fetch = async () => respond([{ id: 1, ...data }]);
  assert.equal((await getEvents())[0].deadline, data.deadline);
  globalThis.fetch = async () => respond([{ id: 1, ...data, deadline: "invalid" }]);
  await assert.rejects(getEvents(), /формат/);
});

test("friend booleans and self error are handled even with HTTP 200", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  globalThis.fetch = async () => respond(false);
  await assert.rejects(sendFriendRequest(2), /Запрос не выполнен/);
  await assert.rejects(removeFriend(2), /Не удалось удалить/);
  globalThis.fetch = async () => respond({ error: "You cant be fr end with yourself" });
  await assert.rejects(sendFriendRequest(1), /себя/);
  globalThis.fetch = async () => respond(true);
  await sendFriendRequest(2);
  await removeFriend(2);
});

test("friend lists deduplicate by ID; requests normalize the backend typo and direction", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const friend = { id: 2, login: "friend", email: "friend@example.com" };
  globalThis.fetch = async () => respond([friend, friend]);
  assert.deepEqual(await getFriends(), [friend]);
  const data = [{ new_freind_id: 2, type: "incoming", accepted_date: null }, { new_freind_id: 3, type: "outgoing", accepted_date: null }];
  globalThis.fetch = async () => respond(data);
  assert.deepEqual(await getFriendRequests(), [{ friend_id: 2, login: null, type: "incoming", accepted_date: null }, { friend_id: 3, login: null, type: "outgoing", accepted_date: null }]);
  globalThis.fetch = async () => respond([{ ...data[0], login: "friend" }]);
  assert.deepEqual(await getFriendRequests(), [{ friend_id: 2, login: "friend", type: "incoming", accepted_date: null }]);
});

test("network, service, malformed JSON and missing auth fail without false success", async () => {
  globalThis.fetch = async () => { assert.fail("must not fetch without a token"); };
  await assert.rejects(getEvents(), /Войдите/);
  sessionStorage.setItem("calendar_access_token", "token");
  globalThis.fetch = async () => { throw new TypeError("network"); };
  await assert.rejects(getEvents(), /Сервер недоступен/);
  globalThis.fetch = async () => respond(null, 503);
  await assert.rejects(getEvents(), /временно/);
  globalThis.fetch = async () => new Response("<html>error</html>");
  await assert.rejects(getEvents(), /формат/);
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, init) => { throw init.signal.reason; };
  await assert.rejects(request("/events/", { signal: controller.signal }), (error) => error.name === "AbortError");
});


test("profile updates keep public fields only", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const user = { id: 3, login: "updated", email: "updated@example.com" };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/users/3");
    assert.equal(init.method, "PATCH");
    assert.equal(init.headers.get("Authorization"), "Bearer token");
    assert.deepEqual(JSON.parse(init.body), { login: user.login, email: user.email, password: "new-password" });
    return respond({ user: { ...user, password: "server-hash" } });
  };
  assert.deepEqual(await updateProfile(user.id, { login: user.login, email: user.email, password: "new-password" }), user);
  globalThis.fetch = async () => respond({ user: null });
  await assert.rejects(updateProfile(3, { login: "a", email: "a@example.com", password: "password" }), /формат/);
});

test("duplicate registration shows a useful error and old contracts fail validation", async () => {
  globalThis.fetch = async () => respond({ detail: "Conflict" }, 409);
  await assert.rejects(register({ login: "a", email: "a@example.com", password: "password" }), /уже занят/);
  sessionStorage.setItem("calendar_access_token", "token");
  globalThis.fetch = async () => respond(null);
  await assert.rejects(createEvent({ name: "test", online: false, deadline: "2026-10-11T00:00:00" }), /формат/);
  for (const item of [{ from_user: 1, to_user: 2, accepted_date: null }, { new_freind_id: 2, type: "invalid", accepted_date: null }]) {
    globalThis.fetch = async () => respond([item]);
    await assert.rejects(getFriendRequests(), /формат/);
  }
});

test("a late unauthorized response cannot clear a newer session", async () => {
  sessionStorage.setItem("calendar_access_token", "old-token");
  globalThis.fetch = async () => {
    sessionStorage.setItem("calendar_access_token", "new-token");
    return respond({ detail: "Unauthorized" }, 401);
  };
  await assert.rejects(getCurrentUser(), (error) => error.status === 401);
  assert.equal(sessionStorage.getItem("calendar_access_token"), "new-token");
});


test("friend request posts directly to the entered ID without a user directory lookup", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init.method });
    assert.equal(init.headers.get("Authorization"), "Bearer token");
    return respond(true);
  };
  await sendFriendRequest(42);
  assert.deepEqual(calls, [{ url: "/api/friends/42", method: "POST" }]);
});


test("friend request by login strips @, encodes the login and explains 404/400", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, method: init.method }); return respond(true); };
  await sendFriendRequestByLogin(" @анна/b ");
  assert.deepEqual(calls, [{ url: "/api/friends/by-login/%D0%B0%D0%BD%D0%BD%D0%B0%2Fb", method: "POST" }]);
  globalThis.fetch = async () => respond({ detail: "user not found" }, 404);
  await assert.rejects(sendFriendRequestByLogin("ghost"), /@ghost не найден/);
  globalThis.fetch = async () => respond({ detail: "self" }, 400);
  await assert.rejects(sendFriendRequestByLogin("me"), /себя/);
  globalThis.fetch = async () => respond(false);
  await assert.rejects(sendFriendRequestByLogin("bob"), /уже отправлена/);
});

const event = {
  id: 7, name: "Party", online: false, deadline: "2099-01-01T15:00:00Z", description: "snacks",
  status: "voting", creator_id: 1, final_start: null, final_end: null,
};
const option = {
  id: 3, start: "2099-02-01T10:00:00Z", end: "2099-02-01T12:00:00Z", author_id: 1,
  author_login: "alice", votes: 2, voters: ["alice", "bob"], voted_by_me: true,
};

test("events keep the new optional fields; create sends description and invites", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const data = { name: "Party", online: false, deadline: "2099-01-01T15:00:00.000Z", description: "snacks", invite_logins: ["bob"] };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/events/");
    assert.deepEqual(JSON.parse(init.body), data);
    return respond(event);
  };
  assert.deepEqual(await createEvent(data), event);
  globalThis.fetch = async () => respond({ detail: "unknown logins: ghost" }, 404);
  await assert.rejects(createEvent(data), /логином не найден/);
});

test("event detail, invites, options, votes and results are validated", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const detail = {
    ...event, creator_login: "alice", my_status: "creator", awaiting_creator: false,
    members: [{ user_id: 1, login: "alice", status: "joined" }, { user_id: 2, login: "bob", status: "invited" }],
  };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([init.method ?? "GET", url, init.body ? JSON.parse(init.body) : undefined]);
    if (url.endsWith("/options")) return respond(option);
    if (url.endsWith("/votes")) return respond([option]);
    if (url.endsWith("/results") || url.endsWith("/close")) {
      return respond({ status: "completed", options: [option], leaders: [3], is_tie: false, voters_count: 2, members_count: 2, final: option, resolved_by: "votes" });
    }
    return respond(detail);
  };
  assert.deepEqual((await getEvent(7)).members[1], { user_id: 2, login: "bob", status: "invited" });
  await inviteToEvent(7, ["bob"]);
  assert.deepEqual(await addOption(7, option.start, option.end), option);
  assert.deepEqual(await setVotes(7, [3]), [option]);
  assert.equal((await getResults(7)).final.id, 3);
  await closeVoting(7);
  await closeVoting(7, 3);
  assert.deepEqual(calls, [
    ["GET", "/api/events/7", undefined],
    ["POST", "/api/events/7/invite", { logins: ["bob"] }],
    ["POST", "/api/events/7/options", { start: option.start, end: option.end }],
    ["PUT", "/api/events/7/votes", { date_option_ids: [3] }],
    ["GET", "/api/events/7/results", undefined],
    ["POST", "/api/events/7/close", { date_option_id: null }],
    ["POST", "/api/events/7/close", { date_option_id: 3 }],
  ]);

  globalThis.fetch = async () => respond({ ...detail, my_status: "owner" });
  await assert.rejects(getEvent(7), /формат/);
  globalThis.fetch = async () => respond({ ...option, voters: [1] });
  await assert.rejects(addOption(7, option.start, option.end), /формат/);
  globalThis.fetch = async () => respond({ detail: { message: "tie", leaders: [1, 2] } }, 409);
  await assert.rejects(closeVoting(7), /Ничья/);
  globalThis.fetch = async () => respond({ detail: "not found" }, 404);
  await assert.rejects(getEvent(7), /не найдено/);
});
