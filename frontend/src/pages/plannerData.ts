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

export function eventCard(event: CalendarEvent) {
  return {
    ...event,
    title: event.name,
    type: event.online ? "Онлайн" : "Офлайн",
    icon: event.online ? "↗" : "☕",
    tone: event.online ? "lavender" : "sage",
    date: readableDate(event.deadline),
  };
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}
