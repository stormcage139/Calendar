import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getCurrentUser, login, register } from "./api/auth";
import type { User } from "./api/auth";
import { clearSession, errorMessage, hasSession, SESSION_EXPIRED_EVENT } from "./api/client";
import Dashboard from "./Dashboard";
import "./App.css";

type Mode = "login" | "register";

function CalendarPreview() {
  return (
    <div className="preview" aria-label="Пример совместного календаря">
      <div className="preview-heading">
        <div>
          <span className="mini-label">НАША НЕДЕЛЯ</span>
          <h3>
            Сентябрь <span>2026</span>
          </h3>
        </div>
        <span className="week-label">21–25 сентября</span>
      </div>
      <div className="calendar">
        <div className="calendar-days">
          <span />
          <span>
            ПН <b>21</b>
          </span>
          <span>
            ВТ <b>22</b>
          </span>
          <span className="today">
            СР <b>23</b>
          </span>
          <span>
            ЧТ <b>24</b>
          </span>
          <span>
            ПТ <b>25</b>
          </span>
        </div>
        <div className="calendar-grid">
          <div className="times">
            <span>09:00</span>
            <span>10:00</span>
            <span>11:00</span>
            <span>12:00</span>
            <span>13:00</span>
          </div>
          <div className="grid-lines" />
          <div className="event event-green">
            <span>09:00 — 10:00</span>
            <strong>Планы на неделю</strong>
            <div className="tiny-avatars">
              <i>А</i>
              <i>М</i>
              <i>Д</i>
            </div>
          </div>
          <div className="event event-purple">
            <span>10:00 — 11:00</span>
            <strong>
              Работа над
              <br />
              проектом
            </strong>
            <small>Команда</small>
          </div>
          <div className="event event-orange">
            <span>11:00 — 12:00</span>
            <strong>Кофе с Машей</strong>
            <small>Кофейня у дома</small>
          </div>
          <div className="event event-soft">
            <span>12:00 — 13:00</span>
            <strong>Время для себя</strong>
          </div>
          <div className="now-line">
            <span />
          </div>
        </div>
      </div>
      <div className="preview-footer">
        <span>
          <i className="dot green" />
          Работа
        </span>
        <span>
          <i className="dot purple" />
          Друзья
        </span>
        <span>
          <i className="dot orange" />
          Личное
        </span>
        <span className="preview-note">Пример календаря</span>
      </div>
      <div className="invite-note">
        <span className="check-circle">✓</span>
        <div>
          <strong>Теперь вы планируете вместе</strong>
          <span>Маша присоединилась к календарю</span>
        </div>
        <span className="note-avatar">М</span>
      </div>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>(() =>
    window.location.hash === "#register" ? "register" : "login",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signedIn, setSignedIn] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(hasSession);
  const [sessionError, setSessionError] = useState("");
  const [loginName, setLoginName] = useState("");

  const restoreSession = useCallback(async (signal?: AbortSignal) => {
    setCheckingSession(true);
    setSessionError("");
    try {
      const user = await getCurrentUser(signal);
      if (!signal?.aborted) setSignedIn(user);
    } catch (cause) {
      if (!signal?.aborted && hasSession()) setSessionError(errorMessage(cause));
    } finally {
      if (!signal?.aborted) setCheckingSession(false);
    }
  }, []);

  function logout(message = "Вы вышли из аккаунта.") {
    clearSession();
    setSignedIn(null);
    setSessionError("");
    setCheckingSession(false);
    setError("");
    setMode("login");
    window.history.replaceState(null, "", "#login");
    setNotice(message);
  }

  useEffect(() => {
    const controller = new AbortController();
    function expired() {
      setSignedIn(null);
      setSessionError("");
      setCheckingSession(false);
      setMode("login");
      window.history.replaceState(null, "", "#login");
      setNotice("Сессия истекла. Войдите снова.");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize the saved session with the backend on mount.
    if (hasSession()) void restoreSession(controller.signal);
    return () => {
      controller.abort();
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    };
  }, [restoreSession]);

  useEffect(() => {
    function syncMode() {
      setMode(window.location.hash === "#register" ? "register" : "login");
      setError("");
      setNotice("");
      setShowPassword(false);
    }
    window.addEventListener("hashchange", syncMode);
    return () => window.removeEventListener("hashchange", syncMode);
  }, []);

  useEffect(() => {
    if (!signedIn) document.title = `${mode === "login" ? "Вход" : "Регистрация"} · Вместе`;
  }, [mode, signedIn]);

  function changeMode(next: Mode) {
    window.location.hash = next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = String(data.get("login") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setError("");
    setNotice("");
    if (!username) {
      setError("Введите логин.");
      return;
    }
    if (mode === "register" && password !== data.get("confirm")) {
      setError("Пароли не совпадают. Проверьте повторный ввод.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await register({
          login: username,
          email: String(data.get("email")).trim(),
          password,
        });
        form.reset();
        setLoginName(username);
        setMode("login");
        window.history.replaceState(null, "", "#login");
        setShowPassword(false);
        setNotice("Аккаунт создан! Введите пароль, чтобы войти.");
      } else {
        await login(username, password);
        form.reset();
        setLoginName(username);
        await restoreSession();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось выполнить запрос. Попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession || sessionError) {
    return <main className="session-panel"><div>
      <span className="eyebrow">ВМЕСТЕ · ВАШЕ ПРОСТРАНСТВО</span>
      <h2>{checkingSession ? "Открываем календарь…" : "Не удалось загрузить профиль"}</h2>
      {checkingSession ? <p className="form-description" role="status">Проверяем вашу сессию.</p> : <>
        <div className="message error" role="alert">{sessionError}</div>
        <button className="primary-button" onClick={() => void restoreSession()}>Попробовать снова <span>↻</span></button>
        <button className="text-button" onClick={() => logout()}>Вернуться ко входу</button>
      </>}
    </div></main>;
  }

  if (signedIn) return <Dashboard user={signedIn} onLogout={logout} />;

  return (
    <main className="auth-layout">
      <section className="story-panel">
        <a
          className="brand"
          href="#login"
          aria-label="Вместе — на страницу входа"
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
        <div className="story-content">
          <span className="eyebrow">
            <span /> ОБЩИЙ КАЛЕНДАРЬ. БОЛЬШЕ ВОЗМОЖНОСТЕЙ.
          </span>
          <h1>
            Ваши планы.
            <br />
            Общее <span className="heading-accent">время.</span>
          </h1>
          <p className="story-description">
            Для встреч, больших идей и обычных вторников.
            <br className="desktop-break" /> Соберите всё важное в одном
            календаре.
          </p>
          <CalendarPreview />
          <div className="story-caption">
            <span className="caption-icon">↗</span>
            <p>
              Меньше «когда тебе удобно?»
              <br />
              <strong>Больше времени друг для друга.</strong>
            </p>
          </div>
        </div>
        <footer className="story-footer">
          <span>© 2026 Вместе</span>
          <span>Хорошие планы начинаются с людей.</span>
        </footer>
      </section>

      <section className="form-panel" aria-label="Личный кабинет">
        <div className="top-prompt">
          {mode === "login" ? "Пока нет аккаунта?" : "Уже есть аккаунт?"}
          <button
            disabled={busy}
            onClick={() =>
              changeMode(mode === "login" ? "register" : "login")
            }
          >
            {mode === "login" ? "Зарегистрироваться" : "Войти"} <span>↗</span>
          </button>
        </div>
        <div className="form-content">
          <div className="welcome-icon" aria-hidden="true">
            {mode === "login" ? "↳" : "+"}
          </div>
          <span className="eyebrow form-eyebrow">
            {mode === "login" ? "РАДЫ ВАС ВИДЕТЬ" : "НАЧНЁМ ПЛАНИРОВАТЬ"}
          </span>
          <h2>
            {mode === "login" ? "С возвращением." : "Всё начинается с вас."}
          </h2>
          <p className="form-description">
            {mode === "login"
              ? "Войдите, чтобы ваши планы снова были под рукой."
              : "Создайте аккаунт. Для ваших планов и ваших людей."}
          </p>
          <div className="mode-switch" aria-label="Способ авторизации">
            <button
              type="button"
              aria-pressed={mode === "login"}
              disabled={busy}
              onClick={() => changeMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              aria-pressed={mode === "register"}
              disabled={busy}
              onClick={() => changeMode("register")}
            >
              Регистрация
            </button>
          </div>
          <form key={mode} onSubmit={handleSubmit} aria-busy={busy}>
            <fieldset disabled={busy}>
              <label htmlFor="login">Логин</label>
              <input
                id="login"
                name="login"
                autoComplete="username"
                placeholder="Ваш логин"
                maxLength={64}
                required
                defaultValue={loginName}
              />
              {mode === "register" && (
                <>
                  <label htmlFor="email">Электронная почта</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    maxLength={128}
                    required
                  />
                </>
              )}
              <label htmlFor="password">Пароль</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "login"
                      ? "Введите пароль"
                      : "Не менее 8 символов"
                  }
                  minLength={mode === "register" ? 8 : 1}
                  required
                />
                <button
                  type="button"
                  className="reveal-button"
                  aria-label={
                    showPassword ? "Скрыть пароль" : "Показать пароль"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    {showPassword && (
                      <path
                        d="m3 3 18 18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    )}
                  </svg>
                </button>
              </div>
              {mode === "register" && (
                <>
                  <label htmlFor="confirm">Повторите пароль</label>
                  <input
                    id="confirm"
                    name="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Ещё раз, чтобы не ошибиться"
                    required
                  />
                </>
              )}
              {error && (
                <div className="message error" role="alert">
                  {error}
                </div>
              )}
              {notice && (
                <div className="message notice" role="status">
                  {notice}
                </div>
              )}
              <button type="submit" className="primary-button">
                {busy ? (
                  <>
                    <span className="spinner" />
                    {mode === "login" ? "Входим…" : "Создаём аккаунт…"}
                  </>
                ) : (
                  <>
                    {mode === "login"
                      ? "Войти в календарь"
                      : "Создать аккаунт"}
                    <span>→</span>
                  </>
                )}
              </button>
            </fieldset>
          </form>
          <div className="form-footnote">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="6"
                y="10"
                width="12"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M9 10V7a3 3 0 0 1 6 0v3m-3 4v2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            Ваше время — в вашем пространстве.
          </div>
        </div>
        <div className="panel-bottom">
          <span className="little-star">✳</span> Оставьте место для хороших
          планов.
          <a className="calendar-demo-link" href="#calendar">
            Посмотреть календарь →
          </a>
        </div>
      </section>
    </main>
  );
}

export default App;
