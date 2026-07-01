import { appState } from "../state.js";
import {
  addDays,
  getMinBookingDate,
  isSameCalendarDay,
  parseDbTimestamp,
  startOfCalendarDay,
} from "../utils/date.js";
import { VISIBLE_MINUTES } from "./constants.js";
import {
  clampResizeEndMinutes,
  clampResizeStartMinutes,
  clampStartMinutesForDay,
  clampWindowMinutes,
  dateFromWindowMinutes,
  getDayWindow,
  getMoveStartMinutesForDay,
  isMoveAllowedOnDay,
  shiftReservationToDay,
  snapMinutes,
} from "./time.js";

const DRAG_THRESHOLD_PX = 5;

let dragState = null;

function getTrackFromPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  return el?.closest(".planner-day-track");
}

function getMinutesOnTrack(track, clientX) {
  const rect = track.getBoundingClientRect();
  const ratio = (clientX - rect.left) / rect.width;
  return clampWindowMinutes(snapMinutes(ratio * VISIBLE_MINUTES));
}

function getDayDateForTrack(track) {
  const dayIndex = Number(track.dataset.dayIndex);
  return startOfCalendarDay(addDays(appState.weekStart, dayIndex));
}

function findReservation(id) {
  return appState.reservations.find((r) => Number(r.id) === Number(id));
}

function applyPreview(item, leftPct, widthPct) {
  item.style.left = `${leftPct}%`;
  item.style.width = `${widthPct}%`;
}

function clearDropTargets() {
  document
    .querySelectorAll(".planner-day-track.drop-target, .planner-day-track.drop-target-invalid")
    .forEach((track) => {
      track.classList.remove("drop-target", "drop-target-invalid");
    });
}

function setDropTarget(track, allowed) {
  track.classList.remove("drop-target", "drop-target-invalid");
  track.classList.add(allowed ? "drop-target" : "drop-target-invalid");
}

function previewMove(item, dayDate, startMinutes, durationMinutes) {
  const { startMinutes: start, endMinutes: end } = clampStartMinutesForDay(
    dayDate,
    startMinutes,
    durationMinutes
  );
  applyPreview(
    item,
    (start / VISIBLE_MINUTES) * 100,
    ((end - start) / VISIBLE_MINUTES) * 100
  );
  return { startMinutes: start, endMinutes: end };
}

function tryCapturePointer(item, pointerId) {
  if (typeof item.setPointerCapture !== "function") return;
  if (typeof pointerId !== "number" || pointerId <= 0) return;
  try {
    item.setPointerCapture(pointerId);
  } catch {
    // Ignore browsers or synthetic events that reject pointer capture.
  }
}

function tryReleasePointer(item, pointerId) {
  if (typeof item.releasePointerCapture !== "function") return;
  if (typeof pointerId !== "number" || pointerId <= 0) return;
  try {
    item.releasePointerCapture(pointerId);
  } catch {
    // Ignore if capture was never acquired or the element re-rendered.
  }
}

export function setupPlannerInteractions(container, {
  onTimesChange,
  onOpenDetails,
  onRevert,
  setStatus,
}) {
  let suppressClick = false;

  container.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const handle = event.target.closest("[data-handle]");
    const item = event.target.closest(".planner-item");
    if (!item) return;

    const reservationId = Number(item.dataset.reservationId);
    const reservation = findReservation(reservationId);
    if (!reservation) return;

    const start = parseDbTimestamp(reservation.start_time);
    const end = parseDbTimestamp(reservation.end_time);
    if (!start || !end) return;

    if (handle) {
      const mode = handle.dataset.handle === "start" ? "resize-start" : "resize-end";
      if (mode === "resize-start" && item.dataset.canResizeStart !== "1") return;
      if (mode === "resize-end" && item.dataset.canResizeEnd !== "1") return;
      event.preventDefault();
      event.stopPropagation();
      const track = item.closest(".planner-day-track");
      dragState = {
        mode,
        item,
        reservationId,
        originStart: new Date(start),
        originEnd: new Date(end),
        track,
        dayDate: getDayDateForTrack(track),
        originDayDate: getDayDateForTrack(track),
        pointerId: event.pointerId,
        startX: event.clientX,
        moved: false,
      };
      tryCapturePointer(item, event.pointerId);
      item.classList.add("is-active");
      return;
    }

    if (item.dataset.canDrag !== "1") {
      dragState = {
        mode: "view",
        item,
        reservationId,
        pointerId: event.pointerId,
        startX: event.clientX,
        moved: false,
      };
      item.setPointerCapture(event.pointerId);
      return;
    }

    event.preventDefault();
    const track = item.closest(".planner-day-track");
    dragState = {
      mode: "move",
      item,
      reservationId,
      durationMs: Number(item.dataset.durationMs),
      originStart: new Date(start),
      originEnd: new Date(end),
      track,
      dayDate: getDayDateForTrack(track),
      originDayDate: getDayDateForTrack(track),
      pointerId: event.pointerId,
      startX: event.clientX,
      moved: false,
    };
    tryCapturePointer(item, event.pointerId);
    item.classList.add("is-dragging");
  });

  container.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (dragState.mode === "view") return;

    if (!dragState.moved && Math.abs(event.clientX - dragState.startX) < DRAG_THRESHOLD_PX) {
      return;
    }
    dragState.moved = true;

    const track = getTrackFromPoint(event.clientX, event.clientY) || dragState.track;
    if (!track) return;

    if (dragState.mode === "move") {
      clearDropTargets();
      const dayDate = getDayDateForTrack(track);
      dragState.track = track;
      dragState.dayDate = dayDate;

      const durationMinutes = dragState.durationMs / 60000;
      const dayOnlyMove = !isSameCalendarDay(dayDate, dragState.originDayDate);
      const startMinutes = dayOnlyMove
        ? getMoveStartMinutesForDay(dragState.originStart, dayDate)
        : getMinutesOnTrack(track, event.clientX);

      const allowed = isMoveAllowedOnDay(dayDate, startMinutes, durationMinutes);
      setDropTarget(track, allowed);
      previewMove(dragState.item, dayDate, startMinutes, durationMinutes);
      return;
    }

    const minutes = getMinutesOnTrack(dragState.track, event.clientX);
    const { windowStart } = getDayWindow(dragState.dayDate);

    if (dragState.mode === "resize-start") {
      const startMinutes = clampResizeStartMinutes(
        dragState.dayDate,
        minutes,
        dragState.originEnd
      );
      if (startMinutes === null) return;
      const width =
        ((dragState.originEnd.getTime() - windowStart.getTime()) / 60000 - startMinutes) /
        VISIBLE_MINUTES *
        100;
      applyPreview(
        dragState.item,
        (startMinutes / VISIBLE_MINUTES) * 100,
        Math.max(width, 0.5)
      );
      dragState.previewStart = dateFromWindowMinutes(dragState.dayDate, startMinutes);
      return;
    }

    if (dragState.mode === "resize-end") {
      const endMinutes = clampResizeEndMinutes(
        dragState.dayDate,
        minutes,
        dragState.originStart
      );
      const startMinutes = (dragState.originStart.getTime() - windowStart.getTime()) / 60000;
      applyPreview(
        dragState.item,
        (startMinutes / VISIBLE_MINUTES) * 100,
        Math.max(((endMinutes - startMinutes) / VISIBLE_MINUTES) * 100, 0.5)
      );
      dragState.previewEnd = dateFromWindowMinutes(dragState.dayDate, endMinutes);
    }
  });

  container.addEventListener("pointerup", async (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const state = dragState;
    dragState = null;
    clearDropTargets();
    suppressClick = true;

    state.item.classList.remove("is-dragging", "is-active");
    tryReleasePointer(state.item, event.pointerId);

    if (!state.moved) {
      onOpenDetails(state.reservationId);
      return;
    }

    if (state.mode === "view") return;

    let newStart = state.originStart;
    let newEnd = state.originEnd;

    if (state.mode === "move") {
      const track = getTrackFromPoint(event.clientX, event.clientY) || state.track;
      const dayDate = getDayDateForTrack(track);
      const durationMinutes = state.durationMs / 60000;
      const dayOnlyMove = !isSameCalendarDay(dayDate, state.originDayDate);

      if (dayOnlyMove) {
        const startMinutes = getMoveStartMinutesForDay(state.originStart, dayDate);
        if (!isMoveAllowedOnDay(dayDate, startMinutes, durationMinutes)) {
          setStatus("Nie można przenieść rezerwacji w przeszłość.", true);
          onRevert?.();
          return;
        }
        ({ newStart, newEnd } = shiftReservationToDay(
          state.originStart,
          state.originEnd,
          dayDate
        ));
      } else {
        const rawMinutes = getMinutesOnTrack(track, event.clientX);
        if (!isMoveAllowedOnDay(dayDate, rawMinutes, durationMinutes)) {
          setStatus("Nie można przenieść rezerwacji w przeszłość.", true);
          onRevert?.();
          return;
        }
        const { startMinutes } = clampStartMinutesForDay(dayDate, rawMinutes, durationMinutes);
        newStart = dateFromWindowMinutes(dayDate, startMinutes);
        newEnd = new Date(newStart.getTime() + state.durationMs);
      }
    } else if (state.mode === "resize-start" && state.previewStart) {
      newStart = state.previewStart;
    } else if (state.mode === "resize-end" && state.previewEnd) {
      newEnd = state.previewEnd;
    } else {
      return;
    }

    const minBooking = getMinBookingDate();
    if (newStart < minBooking) {
      setStatus("Nie można ustawić rezerwacji w przeszłości.", true);
      onRevert?.();
      return;
    }
    if (newStart >= newEnd) {
      setStatus("Godzina końca musi być późniejsza niż startu.", true);
      onRevert?.();
      return;
    }

    await onTimesChange(state.reservationId, newStart, newEnd);
  });

  container.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }

    const item = event.target.closest(".planner-item");
    if (!item) return;
    const reservationId = Number(item.dataset.reservationId);
    if (!reservationId) return;
    onOpenDetails(reservationId);
  });

  container.addEventListener("pointercancel", () => {
    if (!dragState) return;
    dragState.item?.classList.remove("is-dragging", "is-active");
    clearDropTargets();
    dragState = null;
    suppressClick = false;
    onRevert?.();
  });

  container.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest(".planner-item");
    if (!item?.dataset?.reservationId) return;
    event.preventDefault();
    onOpenDetails(Number(item.dataset.reservationId));
  });
}
