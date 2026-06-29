import { appState } from "../state.js";
import { addDays, parseDbTimestamp } from "../utils/date.js";
import { PLANNER_GRID } from "./constants.js";
import {
  clipSegmentToDayWindow,
  formatSegmentTimeRange,
  minutesFromWindowStart,
  renderHourLabelsHtml,
  toWindowPercent,
} from "./time.js";

const reservationsEl = document.querySelector("#reservations");
const weekLabelEl = document.querySelector("#week-label");

const CARD_HEIGHT = 76;
const CARD_GAP = 6;
const MIN_DAY_ROW_HEIGHT = 96;
const ROW_PADDING = 10;

function renderWeekLabel() {
  const start = appState.weekStart;
  const end = addDays(start, 6);
  weekLabelEl.textContent = `${start.toLocaleDateString("pl-PL")} - ${end.toLocaleDateString("pl-PL")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderReservations() {
  renderWeekLabel();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(appState.weekStart, i));
  const now = new Date();
  const hourLabels = renderHourLabelsHtml();

  const dayRows = weekDays
    .map((day, dayIndex) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayReservations = appState.reservations
        .map((r) => {
          const start = parseDbTimestamp(r.start_time);
          const end = parseDbTimestamp(r.end_time);
          if (!start || !end) return null;
          if (end <= dayStart || start >= dayEnd) return null;

          const clippedStart = start < dayStart ? dayStart : start;
          const clippedEnd = end > dayEnd ? dayEnd : end;
          const visible = clipSegmentToDayWindow(clippedStart, clippedEnd, day);
          if (!visible) return null;

          return {
            reservation: r,
            clippedStart,
            clippedEnd,
            visibleStart: visible.visibleStart,
            visibleEnd: visible.visibleEnd,
            start,
            end,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.visibleStart - b.visibleStart);

      const lanesEnd = [];
      const placed = dayReservations.map((item) => {
        let lane = 0;
        while (lane < lanesEnd.length && lanesEnd[lane] > item.visibleStart.getTime()) lane++;
        lanesEnd[lane] = item.visibleEnd.getTime();
        return { ...item, lane };
      });

      const laneCount = Math.max(1, lanesEnd.length);
      const contentHeight = laneCount * CARD_HEIGHT + (laneCount - 1) * CARD_GAP;
      const rowHeight = Math.max(MIN_DAY_ROW_HEIGHT, ROW_PADDING * 2 + contentHeight);

      const items = placed
        .map((item) => {
          const r = item.reservation;
          const startMinutes = minutesFromWindowStart(item.visibleStart, day);
          const durationMinutes =
            minutesFromWindowStart(item.visibleEnd, day) - startMinutes;
          const left = toWindowPercent(startMinutes);
          const width = Math.max(toWindowPercent(durationMinutes), 0.5);
          const top = ROW_PADDING + item.lane * (CARD_HEIGHT + CARD_GAP);
          const pastClass = item.end < now ? "past" : "";
          const userName = escapeHtml(r.user_name || "-");
          const editable = item.end >= now;
          const canResizeStart = editable && item.visibleStart.getTime() === item.start.getTime();
          const canResizeEnd = editable && item.visibleEnd.getTime() === item.end.getTime();
          const durationMs = item.end.getTime() - item.start.getTime();

          return `<div class="planner-item ${pastClass}${editable ? " draggable" : ""}"
            style="left:${left}%;width:${width}%;top:${top}px;height:${CARD_HEIGHT}px"
            data-reservation-id="${r.id}"
            data-day-index="${dayIndex}"
            data-duration-ms="${durationMs}"
            data-can-drag="${editable ? "1" : "0"}"
            data-can-resize-start="${canResizeStart ? "1" : "0"}"
            data-can-resize-end="${canResizeEnd ? "1" : "0"}"
            tabindex="0"
            title="${userName}">
            ${canResizeStart ? '<div class="planner-item-handle planner-item-handle-start" data-handle="start"></div>' : ""}
            <div class="planner-item-body">
              <div class="planner-item-title">${escapeHtml(r.Cars?.name || r.car_id)}</div>
              <div class="planner-item-user">${userName}</div>
              <div class="planner-item-meta">${formatSegmentTimeRange(item.visibleStart, item.visibleEnd)}</div>
            </div>
            ${canResizeEnd ? '<div class="planner-item-handle planner-item-handle-end" data-handle="end"></div>' : ""}
          </div>`;
        })
        .join("");

      const dayLabel = day.toLocaleDateString("pl-PL", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });

      return `<div class="planner-row" style="grid-template-columns:${PLANNER_GRID}" data-day-index="${dayIndex}">
        <div class="planner-day-label">${dayLabel}</div>
        <div class="planner-day-track" data-day-index="${dayIndex}" style="height:${rowHeight}px">${items}</div>
      </div>`;
    })
    .join("");

  reservationsEl.innerHTML = `
    <div class="planner-wrap">
      <div class="planner-scroll">
        <div class="planner-head" style="grid-template-columns:${PLANNER_GRID}">
          <div class="planner-head-corner">Dzień</div>
          <div class="planner-hours-header">${hourLabels}</div>
        </div>
        <div class="planner-body">${dayRows}</div>
      </div>
    </div>`;
}

export function getReservationsContainer() {
  return reservationsEl;
}
