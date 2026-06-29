import { applyBookingTimeLimits } from "../utils/date.js";

const longtermModal = document.querySelector("#longterm-modal");
const openLongtermBtn = document.querySelector("#open-longterm-modal");
const closeLongtermBtn = document.querySelector("#close-longterm-modal");
const longtermForm = document.querySelector("#longterm-form");
const longtermCarSelect = document.querySelector("#longterm-car-select");
const longtermFromDate = document.querySelector("#longterm-from-date");
const longtermToDate = document.querySelector("#longterm-to-date");
const longtermStartTime = document.querySelector("#longterm-start-time");
const longtermEndTime = document.querySelector("#longterm-end-time");
const longtermNotes = document.querySelector("#longterm-notes");

applyBookingTimeLimits(longtermStartTime, longtermEndTime);

export function syncLongtermCarOptions(cars) {
  longtermCarSelect.innerHTML = `
    <option value="">Wybierz auto</option>
    ${cars.map((car) => `<option value="${car.id}">${car.name}</option>`).join("")}
  `;
}

export function setLongtermMinDates(dateValue) {
  longtermFromDate.min = dateValue;
  longtermToDate.min = dateValue;
  if (!longtermFromDate.value) longtermFromDate.value = dateValue;
  if (!longtermToDate.value) longtermToDate.value = dateValue;
}

export function setupLongtermModal({ onSubmit, setDefaults }) {
  openLongtermBtn.addEventListener("click", () => {
    setDefaults?.();
    longtermModal.classList.remove("hidden");
  });

  closeLongtermBtn.addEventListener("click", () => {
    longtermModal.classList.add("hidden");
  });

  longtermModal.addEventListener("click", (event) => {
    if (event.target === longtermModal) longtermModal.classList.add("hidden");
  });

  longtermForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await onSubmit({
      carId: Number(longtermCarSelect.value),
      fromDate: longtermFromDate.value,
      toDate: longtermToDate.value,
      dailyStart: longtermStartTime.value,
      dailyEnd: longtermEndTime.value,
      notes: longtermNotes.value.trim(),
    });
  });
}

export function closeLongtermModal() {
  longtermModal.classList.add("hidden");
}
