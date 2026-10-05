import { useEffect, useRef, useState } from "react";
import "./Planner.css";

// Только примеры для вёрстки. Запросы, сохранение и бизнес-логика не подключены.
const events = [
  {
    title: "Поездка в Казань",
    type: "Поездка",
    icon: "↗",
    status: "Сбор вариантов",
    tone: "sage",
    people: 5,
    date: "До 25 сен, 18:00",
    role: "Вы создатель",
  },
  {
    title: "Встреча с командой",
    type: "Встреча",
    icon: "☕",
    status: "Голосование",
    tone: "lavender",
    people: 8,
    date: "До 22 сен, 12:00",
    role: "Вы участник",
  },
  {
    title: "День рождения Маши",
    type: "Праздник",
    icon: "✳",
    status: "Результат",
    tone: "peach",
    people: 14,
    date: "26 сен, 19:00",
    role: "Вы участник",
  },
  {
    title: "Совещание по проекту",
    type: "Работа",
    icon: "▤",
    status: "Голосование",
    tone: "lavender",
    people: 6,
    date: "До 24 сен, 10:00",
    role: "Вы создатель",
  },
];
const pastEvents = [
  {
    ...events[1],
    title: "Кино с друзьями",
    status: "Завершено",
    date: "18 сен, 20:00",
    people: 4,
  },
  {
    ...events[0],
    title: "Отпуск в Сочи",
    status: "Завершено",
    date: "12 сен, 09:00",
    people: 3,
  },
  {
    ...events[3],
    title: "Хакатон",
    status: "Завершено",
    date: "30 авг, 10:00",
    people: 12,
  },
  {
    ...events[2],
    title: "Корпоратив",
    status: "Завершено",
    date: "15 авг, 18:00",
    people: 25,
  },
];
const friends = [
  { name: "Мария Петрова", tag: "@client1", initials: "МП", tone: "peach" },
  { name: "Иван Сидоров", tag: "@ivan_s", initials: "ИС", tone: "sage" },
  {
    name: "Екатерина Кузнецова",
    tag: "@kate_k",
    initials: "ЕК",
    tone: "lavender",
  },
];
const navigation = [
  {
    id: "home",
    label: "Главная",
    icon: "⌂",
    subtitle: "У вас 4 активных события. Самое время собраться вместе.",
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

function MonthCalendar() {
  return (
    <section className="pl-card pl-month" aria-label="Сентябрь 2026">
      <div className="pl-section-heading">
        <h3>
          Сентябрь <span>2026</span>
        </h3>
        <div className="pl-month-nav">
          <button disabled aria-label="Предыдущий месяц">
            ‹
          </button>
          <button disabled aria-label="Следующий месяц">
            ›
          </button>
        </div>
      </div>
      <div className="pl-month-grid">
        {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((day) => (
          <span className="pl-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: 35 }, (_, index) => {
          const day = index === 0 ? 31 : index > 30 ? index - 30 : index;
          return (
            <span
              key={index}
              className={`pl-day ${index === 0 || index > 30 ? "pl-other-day" : ""} ${index === 20 ? "pl-today" : ""} ${[22, 24, 25, 26].includes(index) ? "pl-event-day" : ""}`}
            >
              {day}
            </span>
          );
        })}
      </div>
      <div className="pl-legend">
        <span>
          <i className="pl-dot sage" /> События
        </span>
        <span>
          <i className="pl-dot lavender" /> Голосование
        </span>
      </div>
    </section>
  );
}

function Timezone() {
  return (
    <select aria-label="Часовой пояс" defaultValue="Москва">
      <option value="Москва">UTC+03:00 — Москва</option>
      <option value="Лондон">UTC+00:00 — Лондон</option>
      <option value="Берлин">UTC+02:00 — Берлин</option>
      <option value="Екатеринбург">UTC+05:00 — Екатеринбург</option>
      <option value="Новосибирск">UTC+07:00 — Новосибирск</option>
      <option value="Токио">UTC+09:00 — Токио</option>
    </select>
  );
}

export default function Planner() {
  const [view, setView] = useState("home");
  const [past, setPast] = useState(false);
  const [eventTab, setEventTab] = useState("Даты");
  const [selectedEvent, setSelectedEvent] = useState(events[0]);
  const createDialog = useRef<HTMLDialogElement>(null);
  const friendDialog = useRef<HTMLDialogElement>(null);
  const page = navigation.find((item) => item.id === view) ?? navigation[1];

  useEffect(() => {
    document.title = "Календарь · Вместе";
  }, []);

  function eventCards(items = events) {
    return (
      <div className="pl-event-list">
        {items.map((event) => (
          <button
            className="pl-event-card"
            key={event.title}
            onClick={() => {
              setSelectedEvent(event);
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
                <span className={`pl-badge ${event.tone}`}>{event.status}</span>
              </span>
              <span className="pl-event-type">
                {event.type} <span>·</span> {event.role}
              </span>
              <span className="pl-event-meta">
                <span>♧ {event.people} участников</span>
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
            aria-label="Поиск событий (скоро)"
            disabled
          />
        </label>
        <div className="pl-header-actions">
          <button
            className="pl-button pl-add-friend"
            onClick={() => friendDialog.current?.showModal()}
          >
            ＋ Добавить друга
          </button>
          <details className="pl-notifications">
            <summary aria-label="Уведомления: 3 новых">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <i />
            </summary>
            <div className="pl-notification-panel pl-card">
              <h3>
                Уведомления <span className="pl-count">3</span>
              </h3>
              <p>
                <strong>Вас пригласили в событие</strong>
                <small>«Поездка в Казань» · 5 минут назад</small>
              </p>
              <p>
                <strong>Новый вариант даты</strong>
                <small>«Встреча с командой» · 1 час назад</small>
              </p>
              <p>
                <strong>Голосование скоро завершится</strong>
                <small>«Совещание по проекту» · 2 часа назад</small>
              </p>
            </div>
          </details>
          <button
            className="pl-avatar sage"
            aria-label="Открыть профиль"
            onClick={() => setView("profile")}
          >
            АЛ
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
              {item.id === "friends" && <span className="pl-count">3</span>}
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
            ЧАСОВОЙ ПОЯС
            <Timezone />
          </label>
          <div className="pl-user">
            <span className="pl-avatar sage">АЛ</span>
            <div>
              <strong>Александр</strong>
              <small>@alex</small>
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
                ? "ВОСКРЕСЕНЬЕ, 20 СЕНТЯБРЯ 2026"
                : "ВАШЕ ПРОСТРАНСТВО / " + page.label.toUpperCase()}
            </span>
            <h1>
              {view === "home" ? (
                <>
                  Привет, Александр<span className="pl-heading-star">✳</span>
                </>
              ) : view === "event" ? (
                selectedEvent.title
              ) : (
                page.label
              )}
            </h1>
            <p>
              {view === "event"
                ? `${selectedEvent.role} · ${selectedEvent.people} участников · ${selectedEvent.date}`
                : page.subtitle}
            </p>
          </div>
          {["home", "events", "calendar"].includes(view) && (
            <button
              className="pl-button pl-primary"
              onClick={() => createDialog.current?.showModal()}
            >
              ＋ Создать событие
            </button>
          )}
          {view === "friends" && (
            <button
              className="pl-button pl-primary"
              onClick={() => friendDialog.current?.showModal()}
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

        {view === "home" && (
          <div className="pl-dashboard">
            <section className="pl-events-section" aria-label="Ваши события">
              <div className="pl-tabs">
                <button aria-pressed={!past} onClick={() => setPast(false)}>
                  Активные <span>4</span>
                </button>
                <button aria-pressed={past} onClick={() => setPast(true)}>
                  Прошедшие <span>4</span>
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
              <MonthCalendar />
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
                <button onClick={() => friendDialog.current?.showModal()}>
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
        {view === "archive" && eventCards(pastEvents)}
        {view === "calendar" && (
          <div className="pl-calendar-layout">
            <MonthCalendar />
            <section>
              <div className="pl-section-heading">
                <h3>В этом месяце</h3>
                <span className="pl-muted">Сентябрь 2026</span>
              </div>
              {eventCards()}
            </section>
          </div>
        )}
        {view === "friends" && (
          <div className="pl-friends-grid">
            {friends.map((friend) => (
              <section className="pl-card pl-friend" key={friend.tag}>
                <span className={`pl-avatar ${friend.tone}`}>
                  {friend.initials}
                </span>
                <h3>{friend.name}</h3>
                <p>{friend.tag}</p>
                <button className="pl-button" disabled>
                  Написать
                </button>
              </section>
            ))}
          </div>
        )}

        {view === "settings" && (
          <div className="pl-settings-grid">
            <section className="pl-card pl-settings-card">
              <h3>Часовой пояс</h3>
              <p>Чтобы находить общее время, где бы вы ни были.</p>
              <Timezone />
            </section>
            <section className="pl-card pl-settings-card">
              <h3>Уведомления</h3>
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
                    defaultChecked={index !== 4}
                  />
                </label>
              ))}
            </section>
            <section className="pl-card pl-settings-card">
              <h3>Голосование по умолчанию</h3>
              <p>Как вы будете выбирать лучшие варианты.</p>
              <label className="pl-radio">
                <input type="radio" name="vote" defaultChecked /> За / Против /
                Нейтрально
              </label>
              <label className="pl-radio">
                <input type="radio" name="vote" /> Ранжирование по приоритету
              </label>
              <label className="pl-setting">
                Показывать промежуточные результаты
                <input type="checkbox" role="switch" defaultChecked />
              </label>
            </section>
            <div className="pl-settings-footer">
              <span className="pl-muted">
                Предпросмотр. Настройки не сохраняются.
              </span>
              <button className="pl-button pl-primary" disabled>
                Сохранить настройки
              </button>
            </div>
          </div>
        )}

        {view === "profile" && (
          <>
            <section className="pl-card pl-profile">
              <span className="pl-avatar sage">АЛ</span>
              <div>
                <h2>Александр</h2>
                <p>@alex · alex@example.com</p>
                <small>UTC+03:00 — Москва</small>
              </div>
              <a className="pl-button" href="#login">
                К странице входа ↗
              </a>
            </section>
            <div className="pl-stats">
              {[
                ["3", "Создано событий"],
                ["8", "Участие в событиях"],
                ["84", "Отдано голосов"],
                ["Топ-3", "По активности"],
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
            {eventCards([...events, ...pastEvents])}
          </>
        )}

        {view === "event" && (
          <>
            <div className="pl-tabs">
              {["Даты", "Места", "Участники", "Обсуждение"].map((tab) => (
                <button
                  key={tab}
                  aria-pressed={eventTab === tab}
                  onClick={() => setEventTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            {eventTab === "Даты" && (
              <div className="pl-calendar-layout">
                <div>
                  <div className="pl-section-heading">
                    <h3>Ваша занятость</h3>
                  </div>
                  <MonthCalendar />
                  <p className="pl-muted pl-help">
                    Промежуток события: 21–30 сентября.
                    <br />
                    Отметки занятости появятся позже.
                  </p>
                </div>
                <section className="pl-card pl-settings-card">
                  <h3>Кто когда свободен</h3>
                  <p>Пример сводки по участникам</p>
                  <div className="pl-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Участник</th>
                          <th scope="col">25 сен</th>
                          <th scope="col">26 сен</th>
                          <th scope="col">27 сен</th>
                        </tr>
                      </thead>
                      <tbody>
                        {friends.map((friend) => (
                          <tr key={friend.tag}>
                            <th scope="row">{friend.name.split(" ")[0]}</th>
                            <td>✓</td>
                            <td>—</td>
                            <td>✓</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>✓ свободен · ✗ занят · — не ответил</p>
                  <div className="pl-result sage">
                    Свободны все: <strong>25 и 27 сентября</strong>
                  </div>
                  <button className="pl-button pl-primary" disabled>
                    Завершить сбор вариантов
                  </button>
                </section>
              </div>
            )}
            {eventTab === "Места" && (
              <section className="pl-card pl-settings-card">
                <h3>Предложенные места</h3>
                {["Кафе «Пушкин»", "Парк Горького"].map((place) => (
                  <div className="pl-setting" key={place}>
                    <strong>{place}</strong>
                    <div className="pl-votes">
                      <button className="pl-button" disabled>
                        За · 3
                      </button>
                      <button className="pl-button" disabled>
                        Против · 1
                      </button>
                      <button className="pl-button" disabled>
                        Нейтрально · 0
                      </button>
                    </div>
                  </div>
                ))}
                <label className="pl-field">
                  Новое место
                  <input placeholder="Название или адрес места" />
                </label>
                <button className="pl-button pl-primary" disabled>
                  ＋ Добавить место
                </button>
              </section>
            )}
            {eventTab === "Участники" && (
              <section className="pl-card pl-settings-card">
                <h3>Участники события</h3>
                <p>Пример списка приглашённых</p>
                {friends.map((friend, index) => (
                  <div className="pl-person-row" key={friend.tag}>
                    <span className={`pl-avatar ${friend.tone}`}>
                      {friend.initials}
                    </span>
                    <div>
                      <strong>{friend.name}</strong>
                      <small>{friend.tag}</small>
                    </div>
                    <span className="pl-badge sage">
                      {index === 2 ? "Приняла приглашение" : "Проголосовал(а)"}
                    </span>
                  </div>
                ))}
                <button className="pl-button pl-primary" disabled>
                  ＋ Пригласить ещё
                </button>
              </section>
            )}
            {eventTab === "Обсуждение" && (
              <section className="pl-card pl-settings-card">
                <h3>Общий чат</h3>
                <p>Обсуждение события</p>
                <div className="pl-chat-message">
                  <strong>
                    Мария Петрова <small>10 минут назад</small>
                  </strong>
                  <p>Я только до 18:00 в среду</p>
                </div>
                <div className="pl-chat-message">
                  <strong>
                    Иван Сидоров <small>5 минут назад</small>
                  </strong>
                  <p>Мне удобнее в четверг</p>
                </div>
                <label className="pl-field">
                  Ваше сообщение
                  <input placeholder="Написать сообщение…" />
                </label>
                <button className="pl-button pl-primary" disabled>
                  Отправить
                </button>
              </section>
            )}
            <button className="pl-button pl-archive-button" disabled>
              Архивировать событие
            </button>
          </>
        )}
        <footer className="pl-footer">
          <span>© 2026 Вместе</span>
          <span>Предпросмотр · Пример данных</span>
          <span>Меньше переписок. Больше встреч.</span>
        </footer>
      </main>

      <dialog
        ref={friendDialog}
        className="pl-dialog"
        aria-labelledby="pl-friend-title"
      >
        <form method="dialog">
          <div className="pl-section-heading">
            <h2 id="pl-friend-title">Добавить друга</h2>
            <button className="pl-icon-button" aria-label="Закрыть">
              ×
            </button>
          </div>
          <p className="pl-muted">Найдите своих людей по тегу.</p>
          <label className="pl-field">
            Тег пользователя
            <input placeholder="@username" />
          </label>
          <p className="pl-help pl-muted">
            Ваш тег можно посмотреть в профиле.
            <br />
            Поиск и отправка приглашений пока недоступны.
          </p>
          <div className="pl-dialog-actions">
            <button className="pl-button">Отмена</button>
            <button type="button" className="pl-button pl-primary" disabled>
              Отправить приглашение
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={createDialog}
        className="pl-dialog"
        aria-labelledby="pl-create-title"
      >
        <form method="dialog">
          <div className="pl-section-heading">
            <h2 id="pl-create-title">
              Новый общий план<span className="pl-heading-star">✳</span>
            </h2>
            <button className="pl-icon-button" aria-label="Закрыть">
              ×
            </button>
          </div>
          <p className="pl-muted">Начните с идеи. Время найдём вместе.</p>
          <label className="pl-field">
            Название
            <input placeholder="Например, поездка в Казань" />
          </label>
          <label className="pl-field">
            Тип события
            <select>
              <option>Поездка</option>
              <option>Встреча</option>
              <option>Праздник</option>
              <option>Работа</option>
            </select>
          </label>
          <div className="pl-date-fields">
            <label className="pl-field">
              Ищем дату с<input type="date" />
            </label>
            <label className="pl-field">
              По
              <input type="date" />
            </label>
          </div>
          <label className="pl-field">
            Дедлайн голосования
            <input type="date" />
          </label>
          <label className="pl-field">
            Описание
            <textarea rows={2} placeholder="Что планируем?" />
          </label>
          <fieldset className="pl-invite-list">
            <legend>Кого пригласить?</legend>
            {friends.map((friend) => (
              <label className="pl-radio" key={friend.tag}>
                <input type="checkbox" />
                {friend.name}
              </label>
            ))}
          </fieldset>
          <label className="pl-field">
            Пригласить по тегу
            <input placeholder="@username" />
          </label>
          <p className="pl-help pl-muted">
            Форма для предпросмотра. Создание событий и ссылки-приглашения пока
            недоступны.
          </p>
          <div className="pl-dialog-actions">
            <button className="pl-button">Отмена</button>
            <button type="button" className="pl-button pl-primary" disabled>
              Создать и пригласить
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
