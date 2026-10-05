import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBrowserEnvironment } from "./environment.mjs";
import { getCurrentUser, login, register } from "../src/api/auth.ts";
import { ApiError, hasSession, request, SESSION_EXPIRED_EVENT } from "../src/api/client.ts";
import { createEvent, getEvents, getFriendRequests, getFriends, removeFriend, sendFriendRequest } from "../src/api/calendar.ts";

installBrowserEnvironment();
const originalFetch = globalThis.fetch;
afterEach(() => { sessionStorage.clear(); globalThis.fetch = originalFetch; });

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

test("login submits OAuth form and uses token_type; protected requests send Bearer", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/token_test");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.get("Content-Type"), "application/x-www-form-urlencoded");
    assert.equal(init.headers.has("Authorization"), false);
    assert.equal(init.body.get("username"), "логин +&");
    assert.equal(init.body.get("password"), "pass +&=");
    return respond({ access_token: "test-token", token_type: "bearer" });
  };
  await login("логин +&", "pass +&=");
  assert.equal(hasSession(), true);
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/users/me/");
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

test("registration accepts the backend JSON string and sends unchanged JSON fields", async () => {
  const data = { login: "hello", email: "hello@example.com", password: "password" };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/users");
    assert.deepEqual(JSON.parse(init.body), data);
    return respond("user created id:1 / login: hello / email: hello@example.com");
  };
  await register(data);
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

test("event creation accepts null; list requires a structured deadline", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const data = { name: "Meeting", online: true, deadline: "2026-10-15T00:00:00" };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/events/");
    assert.deepEqual(JSON.parse(init.body), data);
    return respond(null);
  };
  await createEvent(data);
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

test("friend lists deduplicate by ID; requests preserve both parties and acceptance", async () => {
  sessionStorage.setItem("calendar_access_token", "token");
  const friend = { id: 2, login: "friend", email: "friend@example.com" };
  globalThis.fetch = async () => respond([friend, friend]);
  assert.deepEqual(await getFriends(), [friend]);
  const data = [{ from_user: 2, to_user: 1, accepted_date: null }, { from_user: 1, to_user: 3, accepted_date: "2026-10-01T12:00:00" }];
  globalThis.fetch = async () => respond(data);
  assert.deepEqual(await getFriendRequests(), data);
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
