import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { updateProfile } from "../api/auth";
import type { User } from "../api/auth";
import { createEvent, deleteAccount, getEvents, getFriendRequests, getFriends, pingServer, removeFriend, sendFriendRequest } from "../api/calendar";
import type { CalendarEvent } from "../api/calendar";
import { errorMessage } from "../api/client";
import { useResource } from "../hooks/useResource";
import { dateKey, eventCard, initials, monthDays, readableDate } from "./plannerData";
import "./Planner.css";

const navigation = [
  {
    id: "home",
    label: "Главная",
    icon: "⌂",
    subtitle: "Самое время собраться вместе.",
  },
  {
    id: "events",
    label: "Мои события",
    icon: "▤",
    subtitle: "Большие идеи и маленькие встречи — всё в одном месте.",
  },
  {
    id: "calendar",
    label: "Календарь",
    icon: "▦",
    subtitle: "Ваши события и дедлайны, день за днём.",
  },
  {
    id: "friends",
    label: "Друзья",
    icon: "♧",
    subtitle: "Люди, с которыми хочется проводить время.",
  },
  {
    id: "archive",
    label: "Архив",
    icon: "▱",
    subtitle: "Хорошие планы, которые уже стали воспоминаниями.",
  },
  {
    id: "settings",
    label: "Настройки",
    icon: "⚙",
    subtitle: "Пусть ваше пространство будет удобным для вас.",
  },
  {
    id: "profile",
    label: "Профиль",
    icon: "○",
    subtitle: "Немного о вас и ваших общих планах.",
  },
];

function MonthCalendar({ month, onMonthChange, events, selectedDate, onSelect }: {
  month: Date;
  onMonthChange: (month: Date) => void;
  events: CalendarEvent[];
  selectedDate: string;
  onSelect: (day: string) => void;
}) {
  const title = month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const eventDates = new Set(events.map((event) => event.deadline.slice(0, 10)));
  return (
    <section className="pl-card pl-month" aria-label={title}>
      <div className="pl-section-heading">
        <h3>{month.toLocaleDateString("ru-RU", { month: "long" })} <span>{month.getFullYear()}</span></h3>
        <div className="pl-month-nav">
          <button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Предыдущий месяц">‹</button>
          <button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Следующий месяц">›</button>
        </div>
      </div>
      <div className="pl-month-grid">
        {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((day) => (
          <span className="pl-weekday" key={day}>{day}</span>
        ))}
        {monthDays(month).map((day) => (
          <span key={day.key} role="button" tabIndex={0}
            aria-label={readableDate(day.key)} aria-pressed={selectedDate === day.key}
            aria-current={day.key === dateKey(new Date()) ? "date" : undefined}
            onClick={() => onSelect(day.key)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(day.key); } }}
            className={`pl-day ${day.outside ? "pl-other-day" : ""} ${day.key === dateKey(new Date()) ? "pl-today" : ""} ${eventDates.has(day.key) ? "pl-event-day" : ""}`}
          >{day.day}</span>
        ))}
      </div>
      <div className="pl-legend">
        <span><i className="pl-dot sage" /> События</span>
        <span><i className="pl-dot lavender" /> Голосование · In progress</span>
      </div>
    </section>
  );
}

function ResourceStatus({ resource }: { resource: { loading: boolean; error: string; refresh: () => Promise<void> } }) {
  return <>
    {resource.loading && <p className="pl-muted" role="status">Загружаем…</p>}
    {resource.error && <p className="message error" role="alert">{resource.error} <button className="pl-button" onClick={() => void resource.refresh()}>Повторить</button></p>}
  </>;
}

function Timezone() {
  return (
    <select aria-label="Часовой пояс · In progress" defaultValue="Москва" disabled title="In progress">
      <option value="Москва">UTC+03:00 — Москва</option>
      <option value="Лондон">UTC+00:00 — Лондон</option>
      <option value="Берлин">UTC+02:00 — Берлин</option>
      <option value="Екатеринбург">UTC+05:00 — Екатеринбург</option>
      <option value="Новосибирск">UTC+07:00 — Новосибирск</option>
      <option value="Токио">UTC+09:00 — Токио</option>
    </select>
  );
}

export default function Planner({ user, onLogout }: { user: User; onLogout: (message?: string) => void }) {
  const [view, setView] = useState("home");
  const [past, setPast] = useState(false);
  const [eventTab, setEventTab] = useState("Даты");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const createDialog = useRef<HTMLDialogElement>(null);
  const friendDialog = useRef<HTMLDialogElement>(null);
  const profileDialog = useRef<HTMLDialogElement>(null);
  const eventResource = useResource(getEvents, []);
  const friendResource = useResource(getFriends, []);
  const requestResource = useResource(getFriendRequests, []);
  const page = navigation.find((item) => item.id === view) ?? navigation[1];
  const today = dateKey(new Date());
  const allEvents = [...eventResource.data].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id).map(eventCard);
  const events = allEvents.filter((event) => event.deadline.slice(0, 10) >= today);
  const pastEvents = allEvents.filter((event) => event.deadline.slice(0, 10) < today);
  const selectedEvent = allEvents.find((event) => event.id === selectedEventId);
  const friends = friendResource.data.filter((friend) => friend.id !== user.id).map((friend, index) => ({
    ...friend, name: friend.login, tag: `@${friend.login}`, initials: initials(friend.login), tone: ["peach", "sage", "lavender"][index % 3],
  }));
  const pending = requestResource.data.filter((item) => item.accepted_date === null);
  const incoming = pending.filter((item) => item.type === "incoming");
  const userName = (id: number) => {
    const friend = friends.find((item) => item.id === id);
    return friend ? `@${friend.login}` : `ID ${id}`;
  };

  useEffect(() => { document.title = "Календарь · Вместе"; }, []);

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function openDialog(dialog: { current: HTMLDialogElement | null }) {
    setError("");
    setNotice("");
    dialog.current?.showModal();
  }

  async function refreshFriends() {
    await Promise.all([friendResource.refresh(), requestResource.refresh()]);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get("name") ?? "").trim();
    const day = String(fields.get("deadline") ?? "");
    if (!name || !day) { setError("Укажите название и дедлайн события."); return; }
    void run(async () => {
      const created = await createEvent({ name, online: fields.get("online") === "true", deadline: `${day}T00:00:00` });
      eventResource.setData((previous) => [...previous.filter((item) => item.id !== created.id), created]);
      setSelectedEventId(created.id);
      setEventTab("Даты");
      setMonth(new Date(`${day}T00:00:00`));
      setSelectedDate("");
      form.reset();
      createDialog.current?.close();
      setView("event");
      setNotice("Событие создано.");
      await eventResource.refresh();
    });
  }

  function handleFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = Number(new FormData(form).get("friend_id"));
    if (!Number.isSafeInteger(id) || id <= 0) { setError("Введите положительный целый ID пользователя."); return; }
    if (id === user.id) { setError("Нельзя добавить себя в друзья."); return; }
    if (friends.some((item) => item.id === id)) { setError("Этот пользователь уже в друзьях."); return; }
    void run(async () => {
      await sendFriendRequest(id);
      form.reset();
      friendDialog.current?.close();
      setNotice(incoming.some((item) => item.friend_id === id) ? "Заявка принята." : "Заявка отправлена.");
      await refreshFriends();
    });
  }

  function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const login = String(fields.get("login") ?? "").trim();
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    if (!login || !email || !password) { setError("Заполните все поля профиля."); return; }
    void run(async () => {
      await updateProfile(user.id, { login, email, password });
      profileDialog.current?.close();
      onLogout("Профиль сохранён. Войдите с обновлёнными данными.");
    });
  }

  function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (String(new FormData(event.currentTarget).get("confirm")) !== user.login) {
      setError("Для подтверждения введите свой логин."); return;
    }
    void run(async () => { await deleteAccount(user.id); onLogout("Аккаунт удалён."); });
  }

  function changeMonth(next: Date) { setMonth(next); setSelectedDate(""); }
  function selectDate(day: string) {
    setMonth(new Date(`${day}T00:00:00`));
    setSelectedDate(day);
    setView("calendar");
  }
  const calendar = <MonthCalendar month={month} onMonthChange={changeMonth} events={eventResource.data} selectedDate={selectedDate} onSelect={selectDate} />;

  function eventCards(items = allEvents) {
    return (
      <div className="pl-event-list">
        {!eventResource.loading && !eventResource.error && items.filter((event) => event.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())).length === 0 && <p className="pl-muted">{query ? "События не найдены." : "Пока нет событий."}</p>}
        {items.filter((event) => event.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())).map((event) => (
          <button
            className="pl-event-card"
            key={event.id}
            onClick={() => {
              setSelectedEventId(event.id);
              setMonth(new Date(`${event.deadline.slice(0, 10)}T00:00:00`));
              setEventTab("Даты");
              setView("event");
            }}
          >
            <span className={`pl-event-icon ${event.tone}`} aria-hidden="true">
              {event.icon}
            </span>
            <span className="pl-event-content">
              <span className="pl-event-top">
                <strong>{event.title}</strong>
                <span className={`pl-badge ${event.tone}`}>{event.deadline.slice(0, 10) < today ? "Дедлайн прошёл" : "Ожидается"}</span>
              </span>
              <span className="pl-event-type">
                {event.type} <span>·</span> Событие #{event.id}
              </span>
              <span className="pl-event-meta">
                <span>♧ Участники · In progress</span>
                <span>◷ {event.date}</span>
                <span className="pl-card-arrow" aria-hidden="true">
                  ↗
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="planner">
      <header className="pl-header">
        <a
          className="brand"
          href="#calendar"
          onClick={() => setView("home")}
          aria-label="Вместе — главная"
        >
          <span className="brand-symbol">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="4"
                y="5"
                width="16"
                height="16"
                rx="4"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M8 3v4m8-4v4M4 11h16m-12 5 3 2 5-4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          вместе<span className="brand-period">.</span>
        </a>
        <label className="pl-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
              cx="10"
              cy="10"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <input
            placeholder="Поиск событий"
            aria-label="Поиск событий"
            value={query}
            onChange={(event) => { setQuery(event.target.value); if (!["home", "events", "archive", "calendar", "profile"].includes(view)) setView("events"); }}
          />
        </label>
        <div className="pl-header-actions">
          <button
            className="pl-button pl-add-friend"
            onClick={() => openDialog(friendDialog)}
          >
            ＋ Добавить друга
          </button>
          <details className="pl-notifications">
            <summary aria-label={`Заявки в друзья: ${incoming.length}`}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {incoming.length > 0 && <i />}
            </summary>
            <div className="pl-notification-panel pl-card">
              <h3>Уведомления <span className="pl-count">{incoming.length}</span></h3>
              {incoming.map((item) => <p key={item.friend_id}><strong>Заявка от {userName(item.friend_id)}</strong><button className="pl-button" onClick={() => setView("friends")}>Открыть</button></p>)}
              {!requestResource.loading && !incoming.length && <p>Новых заявок нет.</p>}
              <ResourceStatus resource={requestResource} />
              <p className="pl-muted">Уведомления о событиях · In progress</p>
            </div>
          </details>
          <button
            className="pl-avatar sage"
            aria-label="Открыть профиль"
            onClick={() => setView("profile")}
          >
            {initials(user.login)}
          </button>
        </div>
      </header>

      <aside className="pl-sidebar">
        <span className="pl-kicker">ВАШЕ ПРОСТРАНСТВО</span>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => (
            <button
              key={item.id}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              <span className="pl-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item.id === "friends" && <span className="pl-count">{incoming.length}</span>}
            </button>
          ))}
        </nav>
        <div className="pl-sidebar-note">
          <span aria-hidden="true">✳</span>
          <p>
            Хорошие планы
            <br />
            начинаются <em>с людей.</em>
          </p>
        </div>
        <div className="pl-sidebar-bottom">
          <label className="pl-kicker">
            ЧАСОВОЙ ПОЯС · In progress
            <Timezone />
          </label>
          <div className="pl-user">
            <span className="pl-avatar sage">{initials(user.login)}</span>
            <div>
              <strong>{user.login}</strong>
              <small>@{user.login}</small>
            </div>
            <button
              className="pl-icon-button"
              aria-label="Открыть настройки"
              onClick={() => setView("settings")}
            >
              ⚙
            </button>
          </div>
        </div>
      </aside>

      <main className="pl-main">
        <div className="pl-page-heading">
          <div>
            <span className="pl-kicker">
              {view === "home"
                ? new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()
                : "ВАШЕ ПРОСТРАНСТВО / " + page.label.toUpperCase()}
            </span>
            <h1>
              {view === "home" ? (
                <>
                  Привет, {user.login}<span className="pl-heading-star">✳</span>
                </>
              ) : view === "event" ? (
                selectedEvent?.title ?? "Событие"
              ) : (
                page.label
              )}
            </h1>
            <p>
              {view === "event"
                ? `Дедлайн: ${selectedEvent?.date ?? "—"} · ${selectedEvent?.type ?? ""}`
                : view === "home" ? `Предстоящие дедлайны: ${events.length}. ${page.subtitle}` : page.subtitle}
            </p>
          </div>
          {["home", "events", "calendar"].includes(view) && (
            <button
              className="pl-button pl-primary"
              onClick={() => openDialog(createDialog)}
            >
              ＋ Создать событие
            </button>
          )}
          {view === "friends" && (
            <button
              className="pl-button pl-primary"
              onClick={() => openDialog(friendDialog)}
            >
              ＋ Добавить друга
            </button>
          )}
          {view === "event" && (
            <button className="pl-button" onClick={() => setView("events")}>
              ← К событиям
            </button>
          )}
        </div>

        {error && <p className="message error" role="alert">{error}</p>}
        {notice && <p className="message notice" role="status">{notice}</p>}
        {["home", "events", "archive", "calendar", "profile", "event"].includes(view) && <ResourceStatus resource={eventResource} />}

        {view === "home" && (
          <div className="pl-dashboard">
            <section className="pl-events-section" aria-label="Ваши события">
              <div className="pl-tabs">
                <button aria-pressed={!past} onClick={() => setPast(false)}>
                  Активные <span>{events.length}</span>
                </button>
                <button aria-pressed={past} onClick={() => setPast(true)}>
                  Прошедшие <span>{pastEvents.length}</span>
                </button>
                <span className="pl-list-label">ВАШИ ПЛАНЫ</span>
              </div>
              {eventCards(past ? pastEvents : events)}
              <button
                className="pl-all-events"
                onClick={() => setView("events")}
              >
                Все мои события <span>→</span>
              </button>
            </section>
            <aside className="pl-right-column">
              {calendar}
              <section className="pl-together-card">
                <span className="pl-kicker">ЛУЧШЕ ВМЕСТЕ</span>
                <div className="pl-avatar-stack">
                  {friends.map((friend) => (
                    <span
                      key={friend.tag}
                      className={`pl-avatar ${friend.tone}`}
                    >
                      {friend.initials}
                    </span>
                  ))}
                  <span className="pl-avatar pl-avatar-more">＋</span>
                </div>
                <h3>
                  Найдите время
                  <br />
                  <em>друг для друга.</em>
                </h3>
                <p>
                  Пригласите друзей и соберите
                  <br />
                  общие планы в одном календаре.
                </p>
                <button onClick={() => openDialog(friendDialog)}>
                  Пригласить друга <span>↗</span>
                </button>
              </section>
            </aside>
          </div>
        )}

        {view === "events" && (
          <>
            <div className="pl-tabs">
              <button aria-pressed={!past} onClick={() => setPast(false)}>
                Активные
              </button>
              <button aria-pressed={past} onClick={() => setPast(true)}>
                Прошедшие
              </button>
            </div>
            {eventCards(past ? pastEvents : events)}
          </>
        )}
        {view === "archive" && <><p className="pl-muted">Архивирование · In progress. События с прошедшим дедлайном:</p>{eventCards(pastEvents)}</>}
        {view === "calendar" && (
          <div className="pl-calendar-layout">
            {calendar}
            <section>
              <div className="pl-section-heading">
                <h3>{selectedDate ? readableDate(selectedDate) : "В этом месяце"}</h3>
                {selectedDate ? <button className="pl-button" onClick={() => setSelectedDate("")}>Весь месяц</button> : <span className="pl-muted">{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</span>}
              </div>
              {eventCards(allEvents.filter((event) => selectedDate ? event.deadline.slice(0, 10) === selectedDate : event.deadline.slice(0, 7) === dateKey(month).slice(0, 7)))}
            </section>
          </div>
        )}
        {view === "friends" && <>
          <ResourceStatus resource={friendResource} />
          <ResourceStatus resource={requestResource} />
          <div className="pl-section-heading"><h3>Друзья · {friends.length}</h3><button className="pl-button" disabled={busy || friendResource.loading || requestResource.loading} onClick={() => void refreshFriends()}>Обновить ↻</button></div>
          {!friendResource.loading && !friendResource.error && !friends.length && <p className="pl-muted">Добавьте своего первого друга по ID.</p>}
          <div className="pl-friends-grid">
            {friends.map((friend) => (
              <section className="pl-card pl-friend" key={friend.id}>
                <span className={`pl-avatar ${friend.tone}`}>{friend.initials}</span>
                <h3>{friend.name}</h3><p>{friend.tag}</p>
                <button className="pl-button" disabled>Написать · In progress</button>
                <button className="pl-button" disabled={busy} onClick={() => void run(async () => { await removeFriend(friend.id); setNotice("Друг удалён."); await refreshFriends(); })}>Удалить из друзей</button>
              </section>
            ))}
          </div>
          <div className="pl-section-heading"><h3>Заявки в друзья</h3></div>
          {!requestResource.loading && !requestResource.error && !pending.length && <p className="pl-muted">Нет ожидающих заявок.</p>}
          {pending.map((item) => <section className="pl-card pl-person-row" key={`${item.type}-${item.friend_id}`}>
            <span className="pl-avatar sage">{initials(userName(item.friend_id))}</span>
            <div><strong>{userName(item.friend_id)}</strong><small>{item.type === "incoming" ? "Входящая заявка" : "Исходящая заявка"}</small></div>
            {item.type === "incoming" && <button className="pl-button pl-primary" disabled={busy} onClick={() => void run(async () => { await sendFriendRequest(item.friend_id); setNotice("Заявка принята."); await refreshFriends(); })}>Принять</button>}
            <button className="pl-button" disabled={busy} onClick={() => void run(async () => { await removeFriend(item.friend_id); setNotice("Заявка удалена."); await refreshFriends(); })}>{item.type === "incoming" ? "Отклонить" : "Отменить"}</button>
          </section>)}
        </>}

        {view === "settings" && (
          <div className="pl-settings-grid">
            <section className="pl-card pl-settings-card">
              <h3>Часовой пояс · In progress</h3>
              <p>Чтобы находить общее время, где бы вы ни были.</p>
              <Timezone />
            </section>
            <section className="pl-card pl-settings-card">
              <h3>Уведомления · In progress</h3>
              <p>Выберите, о чём вас уведомлять.</p>
              {[
                "Приглашение в событие",
                "Новый вариант даты или места",
                "Дедлайн голосования",
                "Итоговый результат",
                "Напоминание о событии",
              ].map((label, index) => (
                <label className="pl-setting" key={label}>
                  {label}
                  <input
                    type="checkbox"
                    role="switch"
                    disabled
                    defaultChecked={index !== 4}
                  />
                </label>
              ))}
            </section>
            <section className="pl-card pl-settings-card">
              <h3>Голосование по умолчанию · In progress</h3>
              <p>Как вы будете выбирать лучшие варианты.</p>
              <label className="pl-radio">
                <input type="radio" name="vote" disabled defaultChecked /> За / Против /
                Нейтрально
              </label>
              <label className="pl-radio">
                <input type="radio" name="vote" disabled /> Ранжирование по приоритету
              </label>
              <label className="pl-setting">
                Показывать промежуточные результаты
                <input type="checkbox" role="switch" disabled defaultChecked />
              </label>
            </section>
            <div className="pl-settings-footer">
              <span className="pl-muted">
                In progress · Сохранение настроек пока недоступно.
              </span>
              <button className="pl-button pl-primary" disabled>
                Сохранить настройки · In progress
              </button>
            </div>
          </div>
        )}

        {view === "profile" && (
          <>
            <section className="pl-card pl-profile">
              <span className="pl-avatar sage">{initials(user.login)}</span>
              <div>
                <h2>{user.login}</h2>
                <p>@{user.login} · {user.email}</p>
                <small>ID {user.id}</small>
              </div>
              <button className="pl-button" disabled={busy} onClick={() => { setConfirmDelete(false); openDialog(profileDialog); }}>Редактировать профиль</button>
              <button className="pl-button" disabled={busy} onClick={() => onLogout()}>Выйти ↗</button>
            </section>
            <div className="pl-stats">
              {[
                [String(allEvents.length), "Всего событий"],
                [String(events.length), "Предстоящие дедлайны"],
                [String(friends.length), "Друзей"],
                [String(incoming.length), "Входящих заявок"],
              ].map(([value, label]) => (
                <div className="pl-card" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="pl-section-heading">
              <h3>История событий</h3>
            </div>
            {eventCards(allEvents)}
            <button className="pl-button" disabled={busy} onClick={() => void run(async () => { await pingServer(); setNotice("Соединение с сервером установлено."); })}>Проверить соединение</button>
          </>
        )}

        {view === "event" && selectedEvent && (
          <>
            <div className="pl-tabs">
              {["Даты", "Места", "Участники", "Обсуждение"].map((tab) => (
                <button
                  key={tab}
                  aria-pressed={eventTab === tab}
                  onClick={() => setEventTab(tab)}
                >
                  {tab}{tab !== "Даты" ? " · In progress" : ""}
                </button>
              ))}
            </div>
            {eventTab === "Даты" && (
              <div className="pl-calendar-layout">
                <div>
                  <div className="pl-section-heading">
                    <h3>Дедлайн события</h3>
                  </div>
                  {calendar}
                  <p className="pl-muted pl-help">
                    Дедлайн: {selectedEvent.date}.
                    <br />
                    Отметки занятости · In progress
                  </p>
                </div>
                <section className="pl-card pl-settings-card">
                  <h3>Кто когда свободен</h3>
                  <p>In progress</p>
                  <button className="pl-button pl-primary" disabled>Завершить сбор вариантов · In progress</button>
                </section>
              </div>
            )}
            {eventTab === "Места" && (
              <section className="pl-card pl-settings-card">
                <h3>Предложенные места</h3>
                <p>In progress</p>
                <label className="pl-field">
                  Новое место
                  <input placeholder="Название или адрес места" disabled />
                </label>
                <button className="pl-button pl-primary" disabled>
                  ＋ Добавить место · In progress
                </button>
              </section>
            )}
            {eventTab === "Участники" && (
              <section className="pl-card pl-settings-card">
                <h3>Участники события</h3>
                <p>In progress</p>
                <button className="pl-button pl-primary" disabled>
                  ＋ Пригласить ещё · In progress
                </button>
              </section>
            )}
            {eventTab === "Обсуждение" && (
              <section className="pl-card pl-settings-card">
                <h3>Общий чат</h3>
                <p>Обсуждение события</p>
                <p>In progress</p>
                <label className="pl-field">
                  Ваше сообщение
                  <input placeholder="Написать сообщение…" disabled />
                </label>
                <button className="pl-button pl-primary" disabled>
                  Отправить · In progress
                </button>
              </section>
            )}
            <button className="pl-button pl-archive-button" disabled>
              Архивировать событие · In progress
            </button>
          </>
        )}
        <footer className="pl-footer">
          <span>© {new Date().getFullYear()} Вместе</span>
          <span>Ваши планы вместе</span>
          <span>Меньше переписок. Больше встреч.</span>
        </footer>
      </main>

      <dialog
        ref={friendDialog}
        className="pl-dialog"
        aria-labelledby="pl-friend-title"
        onCancel={(event) => { if (busy) event.preventDefault(); }}
      >
        <form onSubmit={handleFriend} aria-busy={busy}>
          <div className="pl-section-heading">
            <h2 id="pl-friend-title">Добавить друга</h2>
            <button type="button" className="pl-icon-button" aria-label="Закрыть" disabled={busy} onClick={() => friendDialog.current?.close()}>
              ×
            </button>
          </div>
          <p className="pl-muted">Добавьте друга по ID пользователя.</p>
          <label className="pl-field">
            ID пользователя
            <input name="friend_id" type="number" min="1" step="1" max={Number.MAX_SAFE_INTEGER} placeholder="Например, 12" required disabled={busy} autoComplete="off" />
          </label>
          <p className="pl-help pl-muted">
            Свой ID можно посмотреть в профиле.
            <br />
            Введите ID пользователя, которому хотите отправить заявку.
          </p>
          {error && <p className="message error" role="alert">{error}</p>}
          <div className="pl-dialog-actions">
            <button type="button" className="pl-button" disabled={busy} onClick={() => friendDialog.current?.close()}>Отмена</button>
            <button type="submit" className="pl-button pl-primary" disabled={busy}>
              {busy ? "Отправляем…" : "Отправить приглашение"}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={createDialog}
        className="pl-dialog"
        aria-labelledby="pl-create-title"
        onCancel={(event) => { if (busy) event.preventDefault(); }}
      >
        <form onSubmit={handleCreate} aria-busy={busy}>
          <div className="pl-section-heading">
            <h2 id="pl-create-title">
              Новый общий план<span className="pl-heading-star">✳</span>
            </h2>
            <button type="button" className="pl-icon-button" aria-label="Закрыть" disabled={busy} onClick={() => createDialog.current?.close()}>
              ×
            </button>
          </div>
          <p className="pl-muted">Начните с идеи. Время найдём вместе.</p>
          <label className="pl-field">
            Название
            <input name="name" placeholder="Например, поездка в Казань" maxLength={128} required disabled={busy} />
          </label>
          <label className="pl-field">
            Формат события
            <select name="online" defaultValue="false" disabled={busy}>
              <option value="false">Офлайн</option>
              <option value="true">Онлайн</option>
            </select>
          </label>
          <div className="pl-date-fields">
            <label className="pl-field">
              Ищем дату с · In progress<input type="date" disabled />
            </label>
            <label className="pl-field">
              По · In progress
              <input type="date" disabled />
            </label>
          </div>
          <label className="pl-field">
            Дедлайн события
            <input name="deadline" type="date" required disabled={busy} defaultValue={selectedDate || today} />
          </label>
          <label className="pl-field">
            Описание · In progress
            <textarea rows={2} placeholder="Что планируем?" disabled />
          </label>
          <fieldset className="pl-invite-list" disabled>
            <legend>Кого пригласить? · In progress</legend>
            {friends.map((friend) => (
              <label className="pl-radio" key={friend.tag}>
                <input type="checkbox" />
                {friend.name}
              </label>
            ))}
          </fieldset>
          <label className="pl-field">
            Пригласить по тегу · In progress
            <input placeholder="@username" disabled />
          </label>
          <p className="pl-help pl-muted">
            Приглашения, категории событий и ссылки-приглашения · In progress
          </p>
          {error && <p className="message error" role="alert">{error}</p>}
          <div className="pl-dialog-actions">
            <button type="button" className="pl-button" disabled={busy} onClick={() => createDialog.current?.close()}>Отмена</button>
            <button type="submit" className="pl-button pl-primary" disabled={busy}>
              {busy ? "Создаём…" : "Создать событие"}
            </button>
          </div>
        </form>
      </dialog>
      <dialog ref={profileDialog} className="pl-dialog" aria-labelledby="pl-profile-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <form onSubmit={confirmDelete ? handleDelete : handleProfile} aria-busy={busy} key={String(confirmDelete)}>
          <div className="pl-section-heading">
            <h2 id="pl-profile-title">{confirmDelete ? "Удалить аккаунт" : "Редактировать профиль"}</h2>
            <button type="button" className="pl-icon-button" aria-label="Закрыть" disabled={busy} onClick={() => profileDialog.current?.close()}>×</button>
          </div>
          {confirmDelete ? <>
            <p className="pl-muted">Аккаунт будет удалён. Для подтверждения введите логин {user.login}.</p>
            <label className="pl-field">Подтверждение логина<input name="confirm" required disabled={busy} autoComplete="off" /></label>
          </> : <>
            <label className="pl-field">Логин<input name="login" defaultValue={user.login} required maxLength={64} disabled={busy} autoComplete="username" /></label>
            <label className="pl-field">Электронная почта<input name="email" type="email" defaultValue={user.email} required maxLength={128} disabled={busy} autoComplete="email" /></label>
            <label className="pl-field">Пароль<input name="password" type="password" required minLength={8} disabled={busy} autoComplete="new-password" /></label>
            <p className="pl-help pl-muted">Введите текущий или новый пароль. После сохранения нужно будет войти снова.</p>
          </>}
          {error && <p className="message error" role="alert">{error}</p>}
          <div className="pl-dialog-actions">
            <button type="button" className="pl-button" disabled={busy} onClick={() => { setError(""); setConfirmDelete(!confirmDelete); }}>{confirmDelete ? "Назад" : "Удалить аккаунт"}</button>
            <button type="submit" className="pl-button pl-primary" disabled={busy}>{busy ? "Сохраняем…" : confirmDelete ? "Удалить аккаунт навсегда" : "Сохранить профиль"}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
