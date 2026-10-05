import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "./api/auth";
import {
  createEvent, deleteAccount, getEvents, getFriendRequests, getFriends,
  pingServer, removeFriend, sendFriendRequest,
} from "./api/calendar";
import { errorMessage } from "./api/client";
import "./Dashboard.css";

type Tab = "calendar" | "friends" | "account";

function useResource<T>(load: (signal?: AbortSignal) => Promise<T>, initial: T) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const result = await load(current.signal);
      if (!current.signal.aborted) setData(result);
    } catch (cause) {
      if (!current.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Start the external API subscription; cleanup cancels the request.
    void refresh();
    return () => controller.current?.abort();
  }, [refresh]);
  return { data, loading, error, refresh };
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readableDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function ResourceStatus({ loading, error, retry }: {
  loading: boolean; error: string; retry: () => Promise<void>;
}) {
  return <>
    {loading && <p className="empty-note" role="status">Загружаем…</p>}
    {error && <div className="message error" role="alert">
      {error} <button className="text-button" onClick={() => void retry()}>Повторить</button>
    </div>}
  </>;
}

export default function Dashboard({ user, onLogout }: { user: User; onLogout: (message?: string) => void }) {
  const [tab, setTab] = useState<Tab>("calendar");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const events = useResource(getEvents, []);
  const friends = useResource(getFriends, []);
  const requests = useResource(getFriendRequests, []);

  useEffect(() => { document.title = "Ваш календарь · Вместе"; }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function refreshFriends() {
    await Promise.all([friends.refresh(), requests.refresh()]);
  }

  function changeTab(next: Tab) {
    setTab(next);
    setError("");
    setNotice("");
    setConfirmDelete(false);
  }

  function moveMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(dateKey(next));
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get("name") ?? "").trim();
    const day = String(fields.get("deadline") ?? "");
    if (!name || !day) { setError("Укажите название и дату события."); return; }
    void run(async () => {
      // Backend stores Date, so the UI offers a day, without inventing a time.
      await createEvent({ name, online: fields.get("online") === "on", deadline: `${day}T00:00:00` });
      form.reset();
      setSelectedDate(day);
      const [year, monthNumber] = day.split("-").map(Number);
      setMonth(new Date(year, monthNumber - 1, 1));
      setNotice("Событие создано.");
      await events.refresh();
    });
  }

  function handleFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = Number(new FormData(form).get("friend_id"));
    if (!Number.isSafeInteger(id) || id <= 0) { setError("Введите положительный целый ID пользователя."); return; }
    if (id === user.id) { setError("Нельзя добавить себя в друзья."); return; }
    void run(async () => {
      const incoming = requests.data.some((item) => item.from_user === id && item.to_user === user.id && item.accepted_date === null);
      await sendFriendRequest(id);
      form.reset();
      setNotice(incoming ? "Заявка принята." : "Заявка отправлена.");
      await refreshFriends();
    });
  }

  const otherFriends = friends.data.filter((friend) => friend.id !== user.id);
  const pending = requests.data.filter((item) => item.accepted_date === null);
  const incoming = pending.filter((item) => item.to_user === user.id);
  const outgoing = pending.filter((item) => item.from_user === user.id);
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= daysInMonth ? dateKey(new Date(month.getFullYear(), month.getMonth(), day)) : null;
  });
  const eventsByDay = new Map<string, number>();
  for (const event of events.data) {
    const day = event.deadline.slice(0, 10);
    eventsByDay.set(day, (eventsByDay.get(day) ?? 0) + 1);
  }
  const dayEvents = events.data.filter((event) => event.deadline.slice(0, 10) === selectedDate);
  const sortedEvents = [...events.data].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id);
  const friendNames = new Map(otherFriends.map((friend) => [friend.id, friend.login]));

  function eventList(items: typeof events.data) {
    return <ul className="data-list">{items.map((event) => <li key={event.id} className="event-row">
      <span className={`event-mark ${event.online ? "purple" : "green"}`} aria-hidden="true" />
      <div><strong>{event.name}</strong><small>{readableDate(event.deadline)} · {event.online ? "Онлайн" : "Офлайн"}</small></div>
    </li>)}</ul>;
  }

  return <main className="workspace">
    <header className="workspace-header">
      <a className="brand" href="#calendar" onClick={() => { if (!busy) changeTab("calendar"); }} aria-label="Вместе — календарь">
        <span className="brand-symbol" aria-hidden="true">▦</span>вместе<span className="brand-period">.</span>
      </a>
      <div className="workspace-user"><span>{user.login}</span><button className="secondary-button" disabled={busy} onClick={() => onLogout()}>Выйти ↗</button></div>
    </header>
    <div className="workspace-body">
      <aside className="workspace-sidebar">
        <span className="eyebrow">ВАШЕ ПРОСТРАНСТВО</span>
        <nav aria-label="Разделы">
          {([ ["calendar", "Календарь"], ["friends", "Друзья"], ["account", "Профиль"] ] as const).map(([value, label]) =>
            <button key={value} className="nav-button" aria-current={tab === value ? "page" : undefined} disabled={busy} onClick={() => changeTab(value)}>
              {label}{value === "friends" && incoming.length > 0 && <span className="count-badge">{incoming.length}</span>}
            </button>,
          )}
        </nav>
        <p className="sidebar-note">Меньше «когда тебе удобно?»<br />Больше времени друг для друга.</p>
      </aside>
      <section className="workspace-content" aria-label={tab === "calendar" ? "Календарь" : tab === "friends" ? "Друзья" : "Профиль"} aria-busy={busy}>
        <div className="section-heading"><div><span className="eyebrow">ПЛАНИРУЕМ ВМЕСТЕ</span><h1>{tab === "calendar" ? "Ваши планы." : tab === "friends" ? "Ваши люди." : "Ваш профиль."}</h1></div>
          {tab !== "account" && <button className="secondary-button" disabled={busy || (tab === "calendar" ? events.loading : friends.loading || requests.loading)} onClick={() => void (tab === "calendar" ? events.refresh() : refreshFriends())}>Обновить ↻</button>}
        </div>
        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message notice" role="status">{notice}</div>}

        {tab === "calendar" && <div className="workspace-columns">
          <div>
            <section className="workspace-card">
              <div className="month-heading"><h2>{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</h2>
                <div className="month-controls"><button className="secondary-button" aria-label="Предыдущий месяц" onClick={() => moveMonth(-1)}>←</button><button className="secondary-button" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(dateKey(today)); }}>Сегодня</button><button className="secondary-button" aria-label="Следующий месяц" onClick={() => moveMonth(1)}>→</button></div>
              </div>
              <div className="month-grid">
                {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((day) => <span className="weekday" key={day}>{day}</span>)}
                {days.map((day, index) => day ? <button key={day} className="day-cell" aria-pressed={day === selectedDate} aria-label={`${readableDate(day)}, событий: ${eventsByDay.get(day) ?? 0}`} aria-current={day === dateKey(new Date()) ? "date" : undefined} onClick={() => setSelectedDate(day)}>
                  <span>{Number(day.slice(8))}</span>{eventsByDay.has(day) && <small>{eventsByDay.get(day)}</small>}
                </button> : <span key={`empty-${index}`} className="day-empty" />)}
              </div>
              <ResourceStatus loading={events.loading} error={events.error} retry={events.refresh} />
              <h3 className="list-heading">{readableDate(selectedDate)}</h3>
              {eventList(dayEvents)}
              {!events.loading && !events.error && dayEvents.length === 0 && <p className="empty-note">На этот день планов пока нет.</p>}
            </section>
            <section className="workspace-card"><h2>Все события <span className="count-badge">{events.data.length}</span></h2>
              {eventList(sortedEvents)}
              {!events.loading && !events.error && sortedEvents.length === 0 && <p className="empty-note">Добавьте первое событие — здесь появятся ваши планы.</p>}
            </section>
          </div>
          <section className="workspace-card"><span className="eyebrow">НОВЫЙ ПЛАН</span><h2>Добавить событие</h2>
            <form onSubmit={handleCreate}><fieldset disabled={busy}>
              <label htmlFor="event-name">Название</label><input id="event-name" name="name" placeholder="Например, встреча команды" maxLength={128} required />
              <label htmlFor="event-date">Дата</label><input key={selectedDate} id="event-date" name="deadline" type="date" defaultValue={selectedDate} min="0001-01-01" max="9999-12-31" required />
              <label className="checkbox-label"><input name="online" type="checkbox" />Онлайн-событие</label>
              <button className="primary-button" type="submit">{busy ? "Сохраняем…" : "Добавить в календарь"}<span>→</span></button>
            </fieldset></form>
          </section>
        </div>}

        {tab === "friends" && <div className="workspace-columns">
          <div>
            <section className="workspace-card"><h2>Друзья <span className="count-badge">{otherFriends.length}</span></h2>
              <ResourceStatus loading={friends.loading} error={friends.error} retry={friends.refresh} />
              <ul className="data-list">{otherFriends.map((friend) => <li key={friend.id}>
                <span className="person-avatar" aria-hidden="true">{friend.login.slice(0, 1).toUpperCase()}</span><div><strong>{friend.login}</strong><small>{friend.email} · ID {friend.id}</small></div>
                <button className="text-button" disabled={busy} onClick={() => void run(async () => { await removeFriend(friend.id); setNotice("Друг удалён."); await refreshFriends(); })}>Удалить</button>
              </li>)}</ul>
              {!friends.loading && !friends.error && otherFriends.length === 0 && <p className="empty-note">Пригласите друга, чтобы начать планировать вместе.</p>}
            </section>
            <section className="workspace-card"><h2>Заявки в друзья</h2><ResourceStatus loading={requests.loading} error={requests.error} retry={requests.refresh} />
              <h3 className="list-heading">Входящие</h3><ul className="data-list">{incoming.map((item) => <li key={item.from_user}>
                <div><strong>{friendNames.get(item.from_user) ?? `Пользователь #${item.from_user}`}</strong><small>Хочет добавить вас в друзья</small></div><div className="row-actions">
                  <button className="text-button" disabled={busy} onClick={() => void run(async () => { await sendFriendRequest(item.from_user); setNotice("Заявка принята."); await refreshFriends(); })}>Принять</button>
                  <button className="text-button" disabled={busy} onClick={() => void run(async () => { await removeFriend(item.from_user); setNotice("Заявка отклонена."); await refreshFriends(); })}>Отклонить</button>
                </div>
              </li>)}</ul>
              {!requests.loading && !requests.error && incoming.length === 0 && <p className="empty-note">Нет входящих заявок.</p>}
              <h3 className="list-heading">Исходящие</h3><ul className="data-list">{outgoing.map((item) => <li key={item.to_user}>
                <div><strong>Пользователь #{item.to_user}</strong><small>Ожидаем ответа</small></div><button className="text-button" disabled={busy} onClick={() => void run(async () => { await removeFriend(item.to_user); setNotice("Заявка отменена."); await refreshFriends(); })}>Отменить</button>
              </li>)}</ul>
              {!requests.loading && !requests.error && outgoing.length === 0 && <p className="empty-note">Нет исходящих заявок.</p>}
            </section>
          </div>
          <section className="workspace-card"><span className="eyebrow">ПРИГЛАШАЙТЕ СВОИХ</span><h2>Добавить друга</h2><p className="form-description">Укажите ID из профиля друга. Ваш ID: <strong>{user.id}</strong>.</p>
            <form onSubmit={handleFriend}><fieldset disabled={busy}><label htmlFor="friend-id">ID пользователя</label><input id="friend-id" name="friend_id" type="number" min="1" step="1" max={Number.MAX_SAFE_INTEGER} placeholder="Например, 12" required />
              <button className="primary-button" type="submit">{busy ? "Отправляем…" : "Отправить заявку"}<span>→</span></button>
            </fieldset></form>
          </section>
        </div>}

        {tab === "account" && <div className="workspace-columns">
          <section className="workspace-card"><span className="eyebrow">ПРИВЕТ, {user.login}!</span><h2>Данные аккаунта</h2>
            <dl className="profile-details"><dt>Логин</dt><dd>{user.login}</dd><dt>Электронная почта</dt><dd>{user.email}</dd><dt>Ваш ID</dt><dd>{user.id}</dd></dl>
            <button className="secondary-button" disabled={busy} onClick={() => void run(async () => { await pingServer(); setNotice("Сервер доступен."); })}>Проверить соединение ↗</button>
          </section>
          <section className="workspace-card"><h2>Удаление аккаунта</h2><p className="form-description">Аккаунт будет удалён без возможности восстановления.</p>
            {!confirmDelete ? <button className="secondary-button danger-button" disabled={busy} onClick={() => { setConfirmDelete(true); setError(""); setNotice(""); }}>Удалить аккаунт</button> : <form onSubmit={(event) => {
              event.preventDefault();
              if (new FormData(event.currentTarget).get("confirmation") !== user.login) { setError("Для подтверждения введите ваш логин без изменений."); return; }
              void run(async () => { await deleteAccount(user.id); onLogout("Аккаунт удалён."); });
            }}><fieldset disabled={busy}><label htmlFor="delete-confirmation">Для подтверждения введите «{user.login}»</label><input id="delete-confirmation" name="confirmation" autoComplete="off" required />
              <button type="submit" className="primary-button danger-button">{busy ? "Удаляем…" : "Удалить навсегда"}<span>→</span></button>
              <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Отмена</button>
            </fieldset></form>}
          </section>
        </div>}
      </section>
    </div>
  </main>;
}
