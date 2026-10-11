import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { installBrowserEnvironment } from "./environment.mjs";
import { getCurrentUser, login, register, updateProfile } from "../src/api/auth.ts";
import { clearSession } from "../src/api/client.ts";
import { createEvent, deleteAccount, getEvents, getFriendRequests, getFriends, pingServer, removeFriend, sendFriendRequest } from "../src/api/calendar.ts";

installBrowserEnvironment();
const frontend = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(resolve(tmpdir(), "calendar-integration-"));
const probe = createServer();
await new Promise((done, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", done); });
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const python = process.env.BACKEND_PYTHON || resolve(frontend, "../backend/.venv/bin/python");
const server = spawn(python, ["-B", resolve(frontend, "tests/backend_fixture.py"), String(port)], {
  cwd: directory,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONPATH: resolve(frontend, "../backend/src") },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
let startupError;
server.on("error", (error) => { startupError = error; });
server.stdout.on("data", (chunk) => { log += chunk; });
server.stderr.on("data", (chunk) => { log += chunk; });
const originalFetch = globalThis.fetch;
const origin = `http://127.0.0.1:${port}`;
globalThis.fetch = (url, init) => originalFetch(`${origin}${String(url).replace(/^\/api/, "")}`, init);

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (startupError) throw startupError;
    if (server.exitCode !== null) throw new Error(`Backend failed to start: ${log}`);
    try { ready = (await originalFetch(`${origin}/ping`)).ok; } catch { /* wait for startup */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(ready, `Backend did not start: ${log}`);
  await pingServer();
  const first = { login: "integration_one", email: "one@example.com", password: "test-password-1" };
  const second = { login: "integration_two", email: "two@example.com", password: "test-password-2" };
  const registered = await register(first);
  assert.equal(registered.login, first.login);
  await register(second);
  await assert.rejects(register(first), /уже занят/);
  await assert.rejects(login(first.login, "wrong-password"), /Неверный логин/);
  await login(first.login, first.password);
  const me = await getCurrentUser();
  const firstToken = sessionStorage.getItem("calendar_access_token");
  assert.equal(me.login, first.login);
  assert.deepEqual(await getEvents(), []);
  const created = await createEvent({ name: "Совместная встреча", online: true, deadline: "2026-10-15T00:00:00" });
  assert.ok(created.id);
  assert.equal(created.name, "Совместная встреча");
  const events = await getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].deadline, "2026-10-15T00:00:00");

  await login(second.login, second.password);
  const other = await getCurrentUser();
  const secondToken = sessionStorage.getItem("calendar_access_token");
  assert.deepEqual(await getEvents(), []);
  sessionStorage.setItem("calendar_access_token", firstToken);
  await sendFriendRequest(other.id);
  const outgoing = await getFriendRequests();
  assert.deepEqual(outgoing, [{ friend_id: other.id, type: "outgoing", accepted_date: null }]);
  await assert.rejects(sendFriendRequest(other.id), /Запрос не выполнен/);
  sessionStorage.setItem("calendar_access_token", secondToken);
  assert.deepEqual(await getFriendRequests(), [{ friend_id: me.id, type: "incoming", accepted_date: null }]);
  await sendFriendRequest(me.id);
  assert.equal((await getFriends())[0].id, me.id);
  assert.deepEqual(await getFriendRequests(), []);
  sessionStorage.setItem("calendar_access_token", firstToken);
  assert.equal((await getFriends())[0].id, other.id);
  await removeFriend(other.id);
  assert.deepEqual(await getFriends(), []);
  assert.deepEqual(await getFriendRequests(), []);
  await sendFriendRequest(other.id);
  sessionStorage.setItem("calendar_access_token", secondToken);
  await removeFriend(me.id);
  assert.deepEqual(await getFriendRequests(), []);
  await deleteAccount(other.id);
  await assert.rejects(getCurrentUser(), /Сессия истекла/);
  assert.equal(sessionStorage.getItem("calendar_access_token"), null);

  sessionStorage.setItem("calendar_access_token", firstToken);
  await createEvent({ name: "Time audit", online: false, deadline: "2026-10-16T18:30:00+03:00" });
  assert.equal((await getEvents()).find((event) => event.name === "Time audit").deadline, "2026-10-16T00:00:00");
  const changed = { login: "integration_updated", email: "updated@example.com", password: "changed-password" };
  assert.deepEqual(await updateProfile(me.id, changed), { id: me.id, login: changed.login, email: changed.email });
  // JWTs use the login as subject; renaming requires a fresh login.
  await assert.rejects(getCurrentUser(), /Сессия истекла/);
  await assert.rejects(login(first.login, first.password), /Неверный логин/);
  await login(changed.login, changed.password);
  assert.equal((await getCurrentUser()).id, me.id);
  assert.equal((await getEvents()).length, 2);
  clearSession();
  console.log("Integration passed: registration, duplicate registration, JSON login, profile restore/update, event creation/read/isolation, incoming/outgoing requests, acceptance, rejection, removal, account deletion, expired sessions, ping.");
} finally {
  globalThis.fetch = originalFetch;
  server.kill("SIGTERM");
  if (server.exitCode === null && !startupError) await new Promise((done) => server.once("exit", done));
  await rm(directory, { recursive: true, force: true });
}
