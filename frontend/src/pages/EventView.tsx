import { useCallback, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { User } from "../api/auth";
import {
  acceptInvite, addOption, cancelEvent, closeVoting, declineInvite, deleteOption, getEvent,
  getOptions, getResults, inviteToEvent, setVotes, startVoting, updateEvent,
} from "../api/calendar";
import type { DateOption } from "../api/calendar";
import { useResource } from "../hooks/useResource";
import {
  initials, isoToLocalInput, localInputToIso, readableDateTime, readableTimeRange, statusLabels,
} from "./plannerData";
import "./EventView.css";

const resolvedLabels: Record<string, string> = {
  votes: "по итогам голосования",
  creator: "организатором при равенстве голосов",
  deadline: "автоматически по дедлайну",
};

async function loadEvent(id: number, signal?: AbortSignal) {
  // The event first: reading it closes a vote whose deadline has passed.
  const event = await getEvent(id, signal);
  const [options, results] = await Promise.all([getOptions(id, signal), getResults(id, signal)]);
  return { event, options, results };
}

export default function EventView({ eventId, tab, user, friendLogins, busy, run, notify, onChanged, onLeft }: {
  eventId: number;
  tab: "Даты" | "Участники";
  user: User;
  friendLogins: string[];
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  notify: (message: string) => void;
  onChanged: () => Promise<void>;
  onLeft: () => void;
}) {
  const load = useCallback((signal?: AbortSignal) => loadEvent(eventId, signal), [eventId]);
  const resource = useResource(load, null);
  // null: show the user's saved vote; an array: unsaved ticks.
  const [picked, setPicked] = useState<number[] | null>(null);
  const [tiePick, setTiePick] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!resource.data) {
    return <>
      {resource.loading && <p className="pl-muted" role="status">Загружаем событие…</p>}
      {resource.error && <p className="message error" role="alert">{resource.error} <button className="pl-button" onClick={() => void resource.refresh()}>Повторить</button></p>}
    </>;
  }

  const { event, options, results } = resource.data;
  const isCreator = event.my_status === "creator";
  const joined = event.my_status !== "invited";
  const open = event.status === "collecting" || event.status === "voting";
  const deadlinePassed = new Date(event.deadline) <= new Date();
  const savedVote = options.filter((option) => option.voted_by_me).map((option) => option.id);
  const chosen = picked ?? savedVote;
  const voteChanged = chosen.length !== savedVote.length || chosen.some((id) => !savedVote.includes(id));
  const leaders = options.filter((option) => results.leaders.includes(option.id));
  const maxVotes = Math.max(1, ...options.map((option) => option.votes));
  const memberLogins = new Set(event.members.map((member) => member.login));
  const invitable = friendLogins.filter((login) => !memberLogins.has(login));

  async function act(action: () => Promise<unknown>, message: string) {
    await run(async () => {
      await action();
      setPicked(null);
      setTiePick(null);
      await Promise.all([resource.refresh(), onChanged()]);
      notify(message);
    });
  }

  function handleAddOption(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const fields = new FormData(form);
    const start = String(fields.get("start") ?? "");
    const end = String(fields.get("end") ?? "");
    if (!start || !end) return;
    if (new Date(end) <= new Date(start)) { void run(async () => { throw new Error("Конец должен быть позже начала."); }); return; }
    void act(async () => { await addOption(event.id, localInputToIso(start), localInputToIso(end)); form.reset(); }, "Вариант добавлен.");
  }

  function handleInvite(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const logins = String(new FormData(form).get("logins") ?? "")
      .split(/[\s,]+/).map((login) => login.replace(/^@/, "")).filter(Boolean);
    if (!logins.length) return;
    void act(async () => { await inviteToEvent(event.id, logins); form.reset(); }, "Приглашения отправлены.");
  }

  function handleEdit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const fields = new FormData(formEvent.currentTarget);
    const name = String(fields.get("name") ?? "").trim();
    const deadline = String(fields.get("deadline") ?? "");
    if (!name || !deadline) return;
    const changes: Parameters<typeof updateEvent>[1] = {
      name,
      description: String(fields.get("description") ?? "").trim() || null,
      online: fields.get("online") === "true",
    };
    // Send the deadline only when it changed: an unchanged past value would be rejected.
    if (deadline !== isoToLocalInput(event.deadline)) changes.deadline = localInputToIso(deadline);
    void act(async () => { await updateEvent(event.id, changes); setEditing(false); }, "Событие сохранено.");
  }

  function toggle(id: number) {
    setPicked(chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id]);
  }

  function optionRow(option: DateOption, control: ReactNode) {
    const final = results.final?.id === option.id;
    const leading = event.status === "voting" && results.leaders.includes(option.id) && option.votes > 0;
    return (
      <li key={option.id} className={`ev-option ${final ? "ev-final" : ""}`}>
        {control}
        <div className="ev-option-main">
          <strong>{readableTimeRange(option.start, option.end)}</strong>
          <small>
            Предложил(а) @{option.author_login}
            {option.voters.length > 0 && <> · Подходит: {option.voters.map((login) => `@${login}`).join(", ")}</>}
          </small>
          {event.status !== "collecting" && (
            <span className="ev-bar" aria-hidden="true"><i style={{ width: `${(option.votes / maxVotes) * 100}%` }} /></span>
          )}
        </div>
        {event.status !== "collecting" && <span className={`pl-badge ${final || leading ? "sage" : "peach"}`}>{option.votes} {final ? "· итог" : leading ? "· лидер" : ""}</span>}
        {event.status === "collecting" && (isCreator || option.author_id === user.id) && (
          <button className="pl-button" disabled={busy} onClick={() => void act(() => deleteOption(event.id, option.id), "Вариант удалён.")}>Удалить</button>
        )}
      </li>
    );
  }

  const invitation = event.my_status === "invited" && (
    <section className="pl-card pl-settings-card ev-invite">
      <h3>Вас пригласили в событие</h3>
      <p>Организатор: @{event.creator_login}. Примите приглашение, чтобы предлагать даты и голосовать.</p>
      <div className="ev-actions">
        <button className="pl-button pl-primary" disabled={busy || !open} onClick={() => void act(() => acceptInvite(event.id), "Вы участвуете в событии.")}>Принять</button>
        <button className="pl-button" disabled={busy} onClick={() => void run(async () => { await declineInvite(event.id); await onChanged(); onLeft(); notify("Приглашение отклонено."); })}>Отклонить</button>
      </div>
    </section>
  );

  const summary = (
    <section className="pl-card pl-settings-card ev-summary">
      <div className="pl-section-heading">
        <h3>{event.name}</h3>
        <span className={`pl-badge ${event.status === "cancelled" ? "peach" : event.status === "voting" ? "lavender" : "sage"}`}>{statusLabels[event.status ?? "collecting"]}</span>
      </div>
      {event.description && <p className="ev-description">{event.description}</p>}
      <p className="pl-muted">
        Организатор @{event.creator_login} · {event.online ? "Онлайн" : "Офлайн"} · Дедлайн голосования: {readableDateTime(event.deadline)}
        {open && deadlinePassed && " (прошёл)"}
      </p>
      {results.final && (
        <div className="pl-result sage" role="status">
          <strong>Итоговая дата: {readableTimeRange(results.final.start, results.final.end)}</strong>
          Выбрана {resolvedLabels[results.resolved_by ?? "votes"]}.
        </div>
      )}
      {event.awaiting_creator && (
        <div className="pl-result peach" role="status">
          <strong>Дедлайн прошёл, голоса разделились поровну.</strong>
          {isCreator ? "Выберите итоговый вариант среди лидеров ниже." : "Организатор выберет итоговый вариант среди лидеров."}
        </div>
      )}
    </section>
  );

  return (
    <div className="ev-view">
      {invitation}
      {summary}

      {tab === "Даты" && (
        <section className="pl-card pl-settings-card">
          {event.status === "collecting" && <>
            <h3>Варианты даты и времени</h3>
            <p>Участники предлагают удобные слоты. Когда вариантов достаточно, организатор запускает голосование.</p>
            {!options.length && <p className="pl-muted">Пока нет ни одного варианта.</p>}
            <ul className="ev-options">{options.map((option) => optionRow(option, null))}</ul>
            {joined && (
              <form className="ev-add-option" onSubmit={handleAddOption}>
                <div className="pl-date-fields">
                  <label className="pl-field">Начало<input name="start" type="datetime-local" required disabled={busy} /></label>
                  <label className="pl-field">Конец<input name="end" type="datetime-local" required disabled={busy} /></label>
                </div>
                <button className="pl-button" type="submit" disabled={busy}>＋ Предложить вариант</button>
              </form>
            )}
            {isCreator && (
              <div className="ev-actions">
                <button className="pl-button pl-primary" disabled={busy || !options.length} onClick={() => void act(() => startVoting(event.id), "Голосование началось.")}>
                  Завершить сбор вариантов и начать голосование
                </button>
              </div>
            )}
          </>}

          {event.status === "voting" && <>
            <h3>Голосование</h3>
            <p>Отметьте все варианты, которые вам подходят. Побеждает вариант, который подходит большему числу участников.</p>
            <p className="pl-muted">Проголосовали {results.voters_count} из {results.members_count}.</p>
            <ul className="ev-options">
              {options.map((option) => optionRow(option, joined && !deadlinePassed ? (
                <input type="checkbox" aria-label={`Мне подходит: ${readableTimeRange(option.start, option.end)}`}
                  checked={chosen.includes(option.id)} disabled={busy} onChange={() => toggle(option.id)} />
              ) : null))}
            </ul>
            {joined && !deadlinePassed && (
              <div className="ev-actions">
                <button className="pl-button pl-primary" disabled={busy || !voteChanged} onClick={() => void act(() => setVotes(event.id, chosen), "Голос сохранён.")}>
                  {savedVote.length ? "Обновить голос" : "Сохранить голос"}
                </button>
                {voteChanged && <button className="pl-button" disabled={busy} onClick={() => setPicked(null)}>Сбросить</button>}
              </div>
            )}
            {isCreator && (
              <div className="ev-close">
                {results.is_tie ? <>
                  <p className="pl-muted">Сейчас ничья между {leaders.length} вариантами. Чтобы завершить голосование, выберите итоговый:</p>
                  {leaders.map((option) => (
                    <label className="pl-radio" key={option.id}>
                      <input type="radio" name="tie" checked={tiePick === option.id} disabled={busy} onChange={() => setTiePick(option.id)} />
                      {readableTimeRange(option.start, option.end)} · {option.votes}
                    </label>
                  ))}
                  <button className="pl-button pl-primary" disabled={busy || tiePick === null} onClick={() => void act(() => closeVoting(event.id, tiePick ?? undefined), "Итоговая дата выбрана.")}>
                    Завершить голосование с этим вариантом
                  </button>
                </> : (
                  <button className="pl-button pl-primary" disabled={busy} onClick={() => void act(() => closeVoting(event.id), "Голосование завершено.")}>
                    Завершить голосование
                  </button>
                )}
              </div>
            )}
          </>}

          {(event.status === "completed" || event.status === "cancelled") && <>
            <h3>{event.status === "completed" ? "Результаты голосования" : "Событие отменено"}</h3>
            {!options.length && <p className="pl-muted">Варианты не предлагались.</p>}
            <ul className="ev-options">{options.map((option) => optionRow(option, null))}</ul>
          </>}
        </section>
      )}

      {tab === "Участники" && (
        <section className="pl-card pl-settings-card">
          <h3>Участники · {event.members.length}</h3>
          <p>Принявшие приглашение предлагают варианты и голосуют.</p>
          {event.members.map((member) => (
            <div className="pl-person-row" key={member.user_id}>
              <span className="pl-avatar sage">{initials(member.login)}</span>
              <div><strong>@{member.login}</strong><small>{member.user_id === event.creator_id ? "Организатор" : member.login === user.login ? "Вы" : "Участник"}</small></div>
              <span className={`pl-badge ${member.status === "joined" ? "sage" : "peach"}`}>{member.status === "joined" ? "Участвует" : "Приглашён(а)"}</span>
            </div>
          ))}
          {isCreator && open && (
            <form className="ev-invite-form" onSubmit={handleInvite}>
              <label className="pl-field">
                Пригласить по логину
                <input name="logins" placeholder="@username, можно несколько через запятую" disabled={busy} autoComplete="off" />
              </label>
              {invitable.length > 0 && (
                <div className="pl-votes" aria-label="Друзья, которых можно пригласить">
                  {invitable.map((login) => (
                    <button type="button" className="pl-button" key={login} disabled={busy}
                      onClick={() => void act(() => inviteToEvent(event.id, [login]), `@${login} приглашён(а).`)}>＋ @{login}</button>
                  ))}
                </div>
              )}
              <button className="pl-button pl-primary" type="submit" disabled={busy}>Пригласить</button>
            </form>
          )}
        </section>
      )}

      {isCreator && open && (
        <section className="pl-card pl-settings-card">
          <h3>Управление событием</h3>
          {editing ? (
            <form onSubmit={handleEdit}>
              <label className="pl-field">Название<input name="name" defaultValue={event.name} maxLength={128} required disabled={busy} /></label>
              <label className="pl-field">Описание<textarea name="description" rows={2} defaultValue={event.description ?? ""} maxLength={1024} disabled={busy} /></label>
              <label className="pl-field">Формат события
                <select name="online" defaultValue={String(event.online)} disabled={busy}>
                  <option value="false">Офлайн</option>
                  <option value="true">Онлайн</option>
                </select>
              </label>
              <label className="pl-field">Дедлайн голосования<input name="deadline" type="datetime-local" defaultValue={isoToLocalInput(event.deadline)} required disabled={busy} /></label>
              <div className="ev-actions">
                <button className="pl-button pl-primary" type="submit" disabled={busy}>Сохранить</button>
                <button className="pl-button" type="button" disabled={busy} onClick={() => setEditing(false)}>Отмена</button>
              </div>
            </form>
          ) : (
            <div className="ev-actions">
              <button className="pl-button" disabled={busy} onClick={() => { setEditing(true); setConfirmCancel(false); }}>Редактировать</button>
              {confirmCancel ? <>
                <button className="pl-button pl-primary" disabled={busy} onClick={() => void act(() => cancelEvent(event.id), "Событие отменено.")}>Да, отменить событие</button>
                <button className="pl-button" disabled={busy} onClick={() => setConfirmCancel(false)}>Нет</button>
              </> : <button className="pl-button" disabled={busy} onClick={() => setConfirmCancel(true)}>Отменить событие</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
