import { supabase } from "./config.js";
import { appState } from "./state.js";
import {
  addDays,
  applyBookingTimeLimits,
  buildDateTime,
  clampTimeToBookingWindow,
  enumerateCalendarDays,
  getMinBookingDate,
  isDateTimeWithinBookingWindow,
  parseDbTimestamp,
  toLocalInputValue,
  validateBookingTimes,
} from "./utils/date.js";
import { logError, setupGlobalErrorHandlers } from "./utils/errorLogger.js";
import {
  setupLongtermModal,
  syncLongtermCarOptions,
  setLongtermMinDates,
  closeLongtermModal,
} from "./planner/longterm.js";
import { renderReservations, getReservationsContainer } from "./planner/render.js";
import { setupPlannerInteractions } from "./planner/interactions.js";
import {
  checkReservationConflict,
  deleteReservationFromDb,
  fetchReservationsFromDb,
  insertReservation,
  updateReservation,
  updateReservationTimes,
} from "./services/reservations.js";

const statusEl = document.querySelector("#status");

const reservationForm = document.querySelector("#reservation-form");
const carSelect = document.querySelector("#car-select");
const personNameInput = document.querySelector("#person-name");
const startDateInput = document.querySelector("#start-date");
const startInput = document.querySelector("#start-time");
const endDateInput = document.querySelector("#end-date");
const endInput = document.querySelector("#end-time");
const notesInput = document.querySelector("#notes");

const editReservationModal = document.querySelector("#edit-reservation-modal");
const editReservationModalForm = document.querySelector("#edit-reservation-modal-form");
const editReservationCar = document.querySelector("#edit-reservation-car");
const editReservationPerson = document.querySelector("#edit-reservation-person");
const editStartInput = document.querySelector("#edit-modal-start-datetime");
const editEndInput = document.querySelector("#edit-modal-end-datetime");
const editNotesInput = document.querySelector("#edit-modal-notes");
const closeEditReservationModalBtn = document.querySelector("#close-edit-reservation-modal");
const deleteReservationButton = document.querySelector("#delete-reservation-button");
const cancelEditModalBtn = document.querySelector("#cancel-edit-modal");
const endReservationButton = document.querySelector("#end-reservation-button");

const quickReservationBtn = document.querySelector("#quick-reservation-btn");
const quickReservationModal = document.querySelector("#quick-reservation-modal");
const quickReservationForm = document.querySelector("#quick-reservation-form");
const quickCarSelect = document.querySelector("#quick-car-select");
const quickPersonNameInput = document.querySelector("#quick-person-name");
const closeQuickReservationModalBtn = document.querySelector("#close-quick-reservation-modal");

const weekPrevBtn = document.querySelector("#week-prev");
const weekNextBtn = document.querySelector("#week-next");

const longtermPersonNameInput = document.querySelector("#longterm-person-name");
const LIVE_REFRESH_INTERVAL_MS = 15_000;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#156039";
}

function setBookingMinNow() {
  applyBookingTimeLimits(startInput, endInput);

  const minDate = getMinBookingDate();
  const dateValue = toLocalInputValue(minDate).slice(0, 10);
  let timeValue = clampTimeToBookingWindow(toLocalInputValue(minDate).slice(11, 16));
  startDateInput.min = dateValue;
  endDateInput.min = dateValue;
  if (!startDateInput.value) startDateInput.value = dateValue;
  if (!endDateInput.value) endDateInput.value = dateValue;
  if (!startInput.value) startInput.value = timeValue;
  if (!endInput.value) {
    const plusHour = new Date(minDate.getTime() + 60 * 60 * 1000);
    endInput.value = clampTimeToBookingWindow(toLocalInputValue(plusHour).slice(11, 16));
    endDateInput.value = toLocalInputValue(plusHour).slice(0, 10);
  }
  setLongtermMinDates(dateValue);
}

function closeEditReservation() {
  editReservationModal.dataset.reservationId = "";
  editReservationModal.classList.add("hidden");
}

function closeQuickReservationModal() {
  quickReservationModal.classList.add("hidden");
  quickReservationForm.reset();
}

function openQuickReservationModal() {
  quickReservationModal.classList.remove("hidden");
  if (appState.cars.length > 0) {
    quickCarSelect.innerHTML = `
      <option value="">Wybierz auto</option>
      ${appState.cars
        .map((car) => `<option value="${car.id}">${car.name}</option>`)
        .join("")}
    `;
  }
}

async function createQuickReservation(event) {
  event.preventDefault();
  try {
    const carId = Number(quickCarSelect.value);
    const personName = quickPersonNameInput.value.trim();
    
    if (!carId || !personName) {
      return setStatus("Wybierz auto i podaj osobę rezerwującą.", true);
    }

    const now = new Date();
    const start = new Date(now.getTime());
    const end = new Date(now.getTime() + 15 * 60 * 1000);

    const startTime = `${toLocalInputValue(start).replace("T", " ")}:00`;
    const endTime = `${toLocalInputValue(end).replace("T", " ")}:00`;

    const hasConflict = await checkReservationConflict(carId, startTime, endTime);
    if (hasConflict) {
      return setStatus("To auto jest już zarezerwowane w tym momencie.", true);
    }

    await insertReservation({
      car_id: carId,
      user_name: personName,
      start_time: startTime,
      end_time: endTime,
      uwagi: "Rezerwacja szybka",
    });

    await fetchReservations();
    closeQuickReservationModal();
    setStatus("Rezerwacja szybka utworzona.");
  } catch (error) {
    logError("createQuickReservation", error);
    setStatus(`Błąd tworzenia rezerwacji szybkiej: ${error.message}`, true);
  }
}

async function endReservation() {
  try {
    const reservationId = Number(editReservationModal.dataset.reservationId);
    if (!reservationId) return;

    const now = new Date();
    const reservation = appState.reservations.find((r) => Number(r.id) === Number(reservationId));
    
    if (!reservation) return;

    const startDate = parseDbTimestamp(reservation.start_time);
    if (!startDate) return;

    await updateReservation(reservationId, startDate, now, reservation.uwagi || "");
    await fetchReservations();
    closeEditReservation();
    setStatus("Rezerwacja zakończona.");
  } catch (error) {
    logError("endReservation", error);
    setStatus(`Błąd zakańczania rezerwacji: Nie można zakończyć rezerwacji, która jeszcze się nie rozpoczęła`, true);
  }
}

function normalizeStartToMinimumBooking(startDateValue, startTimeValue) {
  const proposedStart = new Date(buildDateTime(startDateValue, startTimeValue));
  const minBookingDate = getMinBookingDate();
  if (proposedStart >= minBookingDate) {
    return { startDateValue, startTimeValue, wasAdjusted: false };
  }

  const adjustedDateValue = toLocalInputValue(minBookingDate).slice(0, 10);
  const adjustedTimeValue = toLocalInputValue(minBookingDate).slice(11, 16);
  return {
    startDateValue: adjustedDateValue,
    startTimeValue: adjustedTimeValue,
    wasAdjusted: true,
  };
}

async function fetchCars() {
  try {
    const { data, error } = await supabase.from("Cars").select("*").order("name");
    if (error) throw error;
    appState.cars = data || [];
    carSelect.innerHTML = `
      <option value="">Wybierz auto</option>
      ${appState.cars
        .map((car) => `<option value="${car.id}">${car.name}</option>`)
        .join("")}
    `;
    syncLongtermCarOptions(appState.cars);
  } catch (error) {
    logError("fetchCars", error);
    throw error;
  }
}

async function fetchReservations() {
  try {
    const reservations = await fetchReservationsFromDb();
    appState.reservations = reservations;
    renderReservations();
  } catch (error) {
    logError("fetchReservations", error);
    throw error;
  }
}

async function saveReservationTimes(id, startDate, endDate) {
  const found = appState.reservations.find((r) => Number(r.id) === Number(id));
  if (!found) return;

  const hasConflict = await checkReservationConflict(
    found.car_id,
    `${toLocalInputValue(startDate).replace("T", " ")}:00`,
    `${toLocalInputValue(endDate).replace("T", " ")}:00`,
    id
  );
  if (hasConflict) {
    setStatus("Konflikt — to auto jest już zarezerwowane w tym czasie.", true);
    renderReservations();
    return;
  }

  try {
    await updateReservationTimes(id, startDate, endDate);
    await fetchReservations();
    setStatus("Termin rezerwacji zaktualizowany.");
  } catch (error) {
    setStatus(`Błąd aktualizacji: ${error.message}`, true);
    renderReservations();
  }
}

async function createLongTermReservations({ carId, fromDate, toDate, dailyStart, dailyEnd, notes }) {
  if (!carId || !fromDate || !toDate || !dailyStart || !dailyEnd) {
    return setStatus("Uzupełnij wszystkie pola rezerwacji długoterminowej.", true);
  }
  if (!longtermPersonNameInput.value.trim()) {
    return setStatus("Osoba rezerwująca jest wymagana.", true);
  }
  if (fromDate > toDate) {
    return setStatus("Data „Od dnia” musi być wcześniejsza lub równa „Do dnia”.", true);
  }
  const timeError = validateBookingTimes(dailyStart, dailyEnd);
  if (timeError) return setStatus(timeError, true);

  const personName = longtermPersonNameInput.value.trim();
  const days = enumerateCalendarDays(fromDate, toDate);
  const minBooking = getMinBookingDate();
  const payloads = [];
  const conflictDays = [];

  for (const day of days) {
    const startRaw = buildDateTime(day, dailyStart);
    const endRaw = buildDateTime(day, dailyEnd);
    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);
    if (startDate < minBooking) {
      return setStatus(
        `Dzień ${day} jest w przeszłości. Wybierz zakres od teraz + 10 minut.`,
        true
      );
    }
    const startTime = `${startRaw.replace("T", " ")}:00`;
    const endTime = `${endRaw.replace("T", " ")}:00`;
    const hasConflict = await checkReservationConflict(carId, startTime, endTime);
    if (hasConflict) conflictDays.push(day);
    else {
      payloads.push({
        car_id: carId,
        user_name: personName,
        start_time: startTime,
        end_time: endTime,
        uwagi: notes || null,
      });
    }
  }

  if (conflictDays.length) {
    return setStatus(
      `Konflikt rezerwacji w dniach: ${conflictDays.join(", ")}. Nic nie zapisano.`,
      true
    );
  }

  try {
    for (const payload of payloads) {
      await insertReservation(payload);
    }
    await fetchReservations();
    closeLongtermModal();
    setStatus(`Utworzono ${payloads.length} rezerwacji cyklicznych.`);
  } catch (error) {
    setStatus(`Błąd zapisu rezerwacji długoterminowej: ${error.message}`, true);
  }
}

async function createReservation(event) {
  event.preventDefault();
  const carId = Number(carSelect.value);
  if (!startDateInput.value || !startInput.value || !endDateInput.value || !endInput.value) {
    return setStatus("Wszystkie pola daty i czasu są wymagane.", true);
  }
  const timeError = validateBookingTimes(startInput.value, endInput.value);
  if (timeError) return setStatus(timeError, true);

  const normalizedStart = normalizeStartToMinimumBooking(startDateInput.value, startInput.value);
  if (normalizedStart.wasAdjusted) {
    startDateInput.value = normalizedStart.startDateValue;
    startInput.value = normalizedStart.startTimeValue;
  }

  const startRaw = buildDateTime(normalizedStart.startDateValue, normalizedStart.startTimeValue);
  const endRaw = buildDateTime(endDateInput.value, endInput.value);
  if (!carId || !startRaw || !endRaw) return setStatus("Wszystkie pola są wymagane.", true);
  if (startRaw >= endRaw) return setStatus("Data startu musi być wcześniejsza niż końca.", true);

  const personName = personNameInput.value.trim();
  if (!personName) return setStatus("Osoba rezerwująca jest wymagana.", true);

  const startTime = `${startRaw.replace("T", " ")}:00`;
  const endTime = `${endRaw.replace("T", " ")}:00`;
  const hasConflict = await checkReservationConflict(carId, startTime, endTime);
  if (hasConflict) {
    alert("To auto jest już zarezerwowane w wybranym czasie.");
    return;
  }

  try {
    await insertReservation({
      car_id: carId,
      user_name: personName,
      start_time: startTime,
      end_time: endTime,
      uwagi: notesInput.value.trim() || null,
    });
    await fetchReservations();
    setStatus("Rezerwacja zapisana.");
    reservationForm.reset();
    setBookingMinNow();
  } catch (error) {
    setStatus(`Błąd dodawania rezerwacji: ${error.message}`, true);
  }
}

async function deleteReservation(id) {
  if (!confirm("Na pewno usunąć tę rezerwację?")) return;
  try {
    await deleteReservationFromDb(id);
    await fetchReservations();
    setStatus("Rezerwacja usunięta.");
  } catch (error) {
    setStatus(`Błąd usuwania rezerwacji: ${error.message}`, true);
  }
}

function openEditReservationForm(id) {
  const reservation = appState.reservations.find((r) => Number(r.id) === Number(id));
  if (!reservation) return;
  const start = parseDbTimestamp(reservation.start_time);
  const end = parseDbTimestamp(reservation.end_time);
  if (!start || !end) return;

  editReservationModal.dataset.reservationId = String(id);
  editReservationCar.value = reservation.Cars?.name || reservation.car_id;
  editReservationPerson.value = reservation.user_name || "";
  editStartInput.value = toLocalInputValue(start);
  editEndInput.value = toLocalInputValue(end);
  editNotesInput.value = reservation.uwagi || "";
  editReservationModal.classList.remove("hidden");
}

async function saveEditedReservation(event) {
  event.preventDefault();
  const reservationId = Number(editReservationModal.dataset.reservationId);
  if (!reservationId) return;

  const startDate = new Date(editStartInput.value);
  const endDate = new Date(editEndInput.value);
  if (isNaN(startDate) || isNaN(endDate)) {
    return setStatus("Błędna data/godzina.", true);
  }
  if (startDate >= endDate) {
    return setStatus("Data startu musi być wcześniejsza niż data końca.", true);
  }
  if (!isDateTimeWithinBookingWindow(startDate) || !isDateTimeWithinBookingWindow(endDate)) {
    return setStatus("Godziny muszą być w zakresie 06:00–22:00.", true);
  }

  const minBookingDate = getMinBookingDate();
  if (startDate < minBookingDate) {
    return setStatus("Nie można ustawić rezerwacji w przeszłości. Wybierz nowy termin.", true);
  }

  try {
    await updateReservation(reservationId, startDate, endDate, editNotesInput.value.trim());
    await fetchReservations();
    closeEditReservation();
    setStatus("Rezerwacja zaktualizowana.");
  } catch (error) {
    setStatus(`Błąd aktualizacji rezerwacji: ${error.message}`, true);
    renderReservations();
  }
}

async function refreshData() {
  renderReservations();
  try {
    await Promise.all([fetchCars(), fetchReservations()]);
  } catch (error) {
    setStatus(`Nie udało się pobrać danych: ${error.message}`, true);
  }
}

async function refreshReservationsLive() {
  try {
    await fetchReservations();
  } catch {
    // Ignore transient network errors; the next poll will retry.
  }
}

function subscribeRealtime() {
  if (appState.realtimeChannel) supabase.removeChannel(appState.realtimeChannel);
  appState.realtimeChannel = supabase
    .channel("reservations-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "Reservations" }, async () => {
      await fetchReservations();
    })
    .subscribe();
}

const reservationsContainer = getReservationsContainer();

setupLongtermModal({
  onSubmit: createLongTermReservations,
  setDefaults: setBookingMinNow,
});

setupPlannerInteractions(reservationsContainer, {
  onTimesChange: saveReservationTimes,
  onOpenDetails: openEditReservationForm,
  onRevert: renderReservations,
  setStatus,
});

reservationForm.addEventListener("submit", createReservation);
editReservationModalForm.addEventListener("submit", saveEditedReservation);
closeEditReservationModalBtn.addEventListener("click", closeEditReservation);
cancelEditModalBtn.addEventListener("click", closeEditReservation);
quickReservationBtn.addEventListener("click", openQuickReservationModal);
closeQuickReservationModalBtn.addEventListener("click", closeQuickReservationModal);
quickReservationForm.addEventListener("submit", createQuickReservation);
endReservationButton.addEventListener("click", endReservation);

document.addEventListener("click", (event) => {
  if (event.target === editReservationModal) closeEditReservation();
  if (event.target === quickReservationModal) closeQuickReservationModal();
});

deleteReservationButton.addEventListener("click", async () => {
  const reservationId = Number(editReservationModal.dataset.reservationId);
  if (!reservationId) return;
  await deleteReservation(reservationId);
  closeEditReservation();
});

weekPrevBtn.addEventListener("click", () => {
  appState.weekStart = addDays(appState.weekStart, -7);
  renderReservations();
});

weekNextBtn.addEventListener("click", () => {
  appState.weekStart = addDays(appState.weekStart, 7);
  renderReservations();
});

setBookingMinNow();
renderReservations();

setInterval(() => {
  setBookingMinNow();
  renderReservations();
}, 30_000);

setInterval(() => {
  refreshReservationsLive();
}, LIVE_REFRESH_INTERVAL_MS);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshReservationsLive();
  }
});

setupGlobalErrorHandlers();
void refreshData();
subscribeRealtime();
