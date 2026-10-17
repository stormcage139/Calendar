import type { CalendarEvent } from "../api/calendar.ts";

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function readableDate(value: string): string {
  // Deadlines are calendar dates in the backend, without a retained time or timezone.
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function monthDays(month: Date) {
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index - offset + 1);
    return { key: dateKey(date), day: date.getDate(), outside: date.getMonth() !== month.getMonth() };
  });
}

// Local calendar day (YYYY-MM-DD) of a timestamp. Backend timestamps are UTC with "Z".
export function localDay(value: string): string {
  return dateKey(new Date(value));
}

export function readableDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function readableTimeRange(start: string, end: string): string {
  const from = new Date(start);
  const to = new Date(end);
  const time = (date: Date) => date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const day = from.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });
  return dateKey(from) === dateKey(to)
    ? `${day}, ${time(from)}–${time(to)}`
    : `${day}, ${time(from)} – ${to.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}, ${time(to)}`;
}

// Value of an <input type="datetime-local"> (local time) as a UTC ISO string.
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

// UTC ISO string as an <input type="datetime-local"> value in local time.
export function isoToLocalInput(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The day an event shows on the calendar: the chosen date once voting is over, the deadline before.
export function eventDay(event: CalendarEvent): string {
  return localDay(event.final_start ?? event.deadline);
}

export const statusLabels: Record<string, string> = {
  collecting: "Сбор вариантов",
  voting: "Голосование",
  completed: "Дата выбрана",
  cancelled: "Отменено",
};

export function eventCard(event: CalendarEvent) {
  return {
    ...event,
    title: event.name,
    type: event.online ? "Онлайн" : "Офлайн",
    icon: event.online ? "↗" : "☕",
    tone: event.online ? "lavender" : "sage",
    date: readableDateTime(event.deadline),
    day: eventDay(event),
    finalDate: event.final_start ? readableDateTime(event.final_start) : null,
  };
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}
