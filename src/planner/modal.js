import { canDeleteReservation, canEditReservation } from "../permissions.js";
import { parseDbTimestamp } from "../utils/date.js";

const reservationModal = document.querySelector("#reservation-modal");
const closeReservationModalBtn = document.querySelector("#close-reservation-modal");
const reservationModalCar = document.querySelector("#reservation-modal-car");
const reservationModalUser = document.querySelector("#reservation-modal-user");
const reservationModalStart = document.querySelector("#reservation-modal-start");
const reservationModalEnd = document.querySelector("#reservation-modal-end");
const reservationModalNotes = document.querySelector("#reservation-modal-notes");
const reservationModalActions = document.querySelector("#reservation-modal-actions");

export function closeReservationModal() {
  reservationModal.classList.add("hidden");
  reservationModal.dataset.reservationId = "";
}

export function openReservationModal(reservation, profile) {
  const start = parseDbTimestamp(reservation.start_time);
  const end = parseDbTimestamp(reservation.end_time);
  if (!start || !end) return;

  reservationModal.dataset.reservationId = String(reservation.id);
  reservationModalCar.textContent = reservation.Cars?.name || String(reservation.car_id);
  reservationModalUser.textContent = reservation.user_name || "-";
  reservationModalStart.textContent = start.toLocaleString("pl-PL");
  reservationModalEnd.textContent = end.toLocaleString("pl-PL");
  reservationModalNotes.textContent = reservation.uwagi || "-";

  const isPast = end < new Date();
  const canEdit = !isPast && canEditReservation(profile, reservation);
  const canDelete = !isPast && canDeleteReservation(profile, reservation);

  reservationModalActions.innerHTML = `
    ${canEdit ? `<button type="button" id="reservation-modal-edit">Edytuj</button>` : ""}
    ${canDelete ? `<button type="button" id="reservation-modal-delete">Usuń</button>` : ""}`;

  reservationModal.classList.remove("hidden");
}

export function setupReservationModal({ onEdit, onDelete }) {
  closeReservationModalBtn.addEventListener("click", closeReservationModal);
  reservationModal.addEventListener("click", (event) => {
    if (event.target === reservationModal) closeReservationModal();
  });

  reservationModalActions.addEventListener("click", async (event) => {
    const reservationId = Number(reservationModal.dataset.reservationId);
    if (!reservationId) return;
    if (event.target.id === "reservation-modal-edit") {
      await onEdit(reservationId);
      return;
    }
    if (event.target.id === "reservation-modal-delete") {
      await onDelete(reservationId);
      closeReservationModal();
    }
  });

  return {
    closeReservationModal,
    getOpenReservationId: () => Number(reservationModal.dataset.reservationId) || null,
  };
}
