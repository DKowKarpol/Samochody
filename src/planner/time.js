import {
  PLANNER_END_HOUR,
  PLANNER_START_HOUR,
  SNAP_MINUTES,
  VISIBLE_MINUTES,
} from "./constants.js";
import { getMinBookingDate } from "../utils/date.js";

export function getDayWindow(dayDate) {
  const windowStart = new Date(dayDate);
  windowStart.setHours(PLANNER_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(dayDate);
  windowEnd.setHours(PLANNER_END_HOUR, 0, 0, 0);
  return { windowStart, windowEnd };
}

export function minutesFromWindowStart(date, dayDate) {
  const { windowStart } = getDayWindow(dayDate);
  return Math.round((date.getTime() - windowStart.getTime()) / 60000);
}

export function toWindowPercent(minutes) {
  return (minutes / VISIBLE_MINUTES) * 100;
}

export function dateFromWindowMinutes(dayDate, minutes) {
  const { windowStart } = getDayWindow(dayDate);
  return new Date(windowStart.getTime() + minutes * 60000);
}

export function snapMinutes(minutes) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

export function clampWindowMinutes(minutes) {
  return Math.max(0, Math.min(VISIBLE_MINUTES, minutes));
}

export function getVisibleHourLabels() {
  const hours = [];
  for (let hour = PLANNER_START_HOUR; hour <= PLANNER_END_HOUR; hour += 1) {
    hours.push(hour);
  }
  return hours;
}

export function renderHourLabelsHtml() {
  const hours = getVisibleHourLabels();
  return hours
    .map((hour) => {
      const label = `${String(hour).padStart(2, "0")}:00`;
      if (hour === PLANNER_START_HOUR) {
        return `<div class="hour-label hour-label-start">${label}</div>`;
      }
      if (hour === PLANNER_END_HOUR) {
        return `<div class="hour-label hour-label-end">${label}</div>`;
      }
      const left = toWindowPercent((hour - PLANNER_START_HOUR) * 60);
      return `<div class="hour-label" style="left:${left}%">${label}</div>`;
    })
    .join("");
}

/** Najwcześniejsza pozycja (w minutach okna 6–22) dozwolona na dany dzień. */
export function getMinAllowedWindowMinutes(dayDate) {
  const minBooking = getMinBookingDate();
  const { windowStart, windowEnd } = getDayWindow(dayDate);
  if (minBooking >= windowEnd) return VISIBLE_MINUTES;
  if (minBooking <= windowStart) return 0;
  return clampWindowMinutes(snapMinutes(minutesFromWindowStart(minBooking, dayDate)));
}

export function clampStartMinutesForDay(dayDate, startMinutes, durationMinutes) {
  const minStart = getMinAllowedWindowMinutes(dayDate);
  let start = Math.max(clampWindowMinutes(snapMinutes(startMinutes)), minStart);
  let end = start + durationMinutes;
  if (end > VISIBLE_MINUTES) {
    end = VISIBLE_MINUTES;
    start = Math.max(minStart, end - durationMinutes);
  }
  return { startMinutes: start, endMinutes: end };
}

export function clampResizeStartMinutes(dayDate, minutes, endDate) {
  const minStart = getMinAllowedWindowMinutes(dayDate);
  const start = Math.max(clampWindowMinutes(snapMinutes(minutes)), minStart);
  const { windowStart } = getDayWindow(dayDate);
  const endMinutes = (endDate.getTime() - windowStart.getTime()) / 60000;
  if (start >= endMinutes - SNAP_MINUTES) return null;
  return start;
}

export function clampResizeEndMinutes(dayDate, minutes, startDate) {
  const { windowStart } = getDayWindow(dayDate);
  const startMinutes = (startDate.getTime() - windowStart.getTime()) / 60000;
  const minEnd = Math.max(
    startMinutes + SNAP_MINUTES,
    getMinAllowedWindowMinutes(dayDate)
  );
  const end = Math.max(clampWindowMinutes(snapMinutes(minutes)), minEnd);
  if (end > VISIBLE_MINUTES) return VISIBLE_MINUTES;
  return end;
}

export function isMoveAllowedOnDay(dayDate, rawStartMinutes, durationMinutes) {
  const minStart = getMinAllowedWindowMinutes(dayDate);
  if (minStart >= VISIBLE_MINUTES) return false;
  const rawSnapped = clampWindowMinutes(snapMinutes(rawStartMinutes));
  if (rawSnapped < minStart) return false;
  const { startMinutes, endMinutes } = clampStartMinutesForDay(
    dayDate,
    rawStartMinutes,
    durationMinutes
  );
  if (endMinutes > VISIBLE_MINUTES) return false;
  const proposedStart = dateFromWindowMinutes(dayDate, startMinutes);
  return proposedStart >= getMinBookingDate();
}

export function formatSegmentTimeRange(visibleStart, visibleEnd) {
  return `${visibleStart.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} - ${visibleEnd.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
}

export function getMoveStartMinutesForDay(originStart, targetDayDate) {
  const shifted = new Date(targetDayDate);
  shifted.setHours(originStart.getHours(), originStart.getMinutes(), 0, 0);
  return minutesFromWindowStart(shifted, targetDayDate);
}

export function shiftReservationToDay(originStart, originEnd, targetDayDate) {
  const newStart = new Date(targetDayDate);
  newStart.setHours(originStart.getHours(), originStart.getMinutes(), 0, 0);
  const durationMs = originEnd.getTime() - originStart.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);
  return { newStart, newEnd };
}

export function clipSegmentToDayWindow(clippedStart, clippedEnd, dayDate) {
  const { windowStart, windowEnd } = getDayWindow(dayDate);
  if (clippedEnd <= windowStart || clippedStart >= windowEnd) return null;
  return {
    visibleStart: clippedStart < windowStart ? windowStart : clippedStart,
    visibleEnd: clippedEnd > windowEnd ? windowEnd : clippedEnd,
  };
}
