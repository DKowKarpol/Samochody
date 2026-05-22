export function toDbLocalTimestamp(value) {
  return `${value.replace("T", " ")}:00`;
}

export function buildDateTime(dateValue, timeValue) {
  return `${dateValue}T${timeValue}`;
}

export function parseDbTimestamp(value) {
  if (!value) return null;
  return new Date(value.replace(" ", "T"));
}

export function toLocalInputValue(date) {
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + diff);
  return result;
}

export function getMinBookingDate() {
  const min = new Date(Date.now() + 10 * 60 * 1000);
  min.setSeconds(0, 0);
  return min;
}

export function startOfCalendarDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function applyTimeOfDayToDate(dayDate, sourceDate) {
  const result = startOfCalendarDay(dayDate);
  result.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);
  return result;
}

export function enumerateCalendarDays(fromDateStr, toDateStr) {
  const days = [];
  const current = startOfCalendarDay(new Date(`${fromDateStr}T12:00:00`));
  const end = startOfCalendarDay(new Date(`${toDateStr}T12:00:00`));
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function formatTimeHm(date) {
  return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}
