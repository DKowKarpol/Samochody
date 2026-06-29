import { API_BASE_URL } from "../config.js";
import { toDbLocalTimestamp, toLocalInputValue } from "../utils/date.js";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `HTTP ${response.status}`;
    try {
      const payload = JSON.parse(errorBody);
      if (payload?.error) errorMessage = payload.error;
    } catch {
      if (errorBody) errorMessage = errorBody;
    }
    throw new Error(errorMessage);
  }

  return response.status === 204 ? null : response.json();
}

export async function fetchReservationsFromDb() {
  return request("/api/reservations");
}

export async function checkReservationConflict(carId, startTime, endTime, excludeId = null) {
  const data = await request("/api/reservations/conflict", {
    method: "POST",
    body: JSON.stringify({
      car_id: carId,
      start_time: startTime,
      end_time: endTime,
      exclude_id: excludeId,
    }),
  });
  return data.conflict;
}

export async function insertReservation(payload) {
  await request("/api/reservations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReservationTimes(id, startDate, endDate) {
  await request(`/api/reservations/${id}/time`, {
    method: "PATCH",
    body: JSON.stringify({
      start_time: toDbLocalTimestamp(toLocalInputValue(startDate)),
      end_time: toDbLocalTimestamp(toLocalInputValue(endDate)),
    }),
  });
}

export async function updateReservation(id, startDate, endDate, notes) {
  await request(`/api/reservations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      start_time: toDbLocalTimestamp(toLocalInputValue(startDate)),
      end_time: toDbLocalTimestamp(toLocalInputValue(endDate)),
      uwagi: notes || null,
    }),
  });
}

export async function deleteReservationFromDb(reservationId) {
  await request(`/api/reservations/${reservationId}`, {
    method: "DELETE",
  });
}
