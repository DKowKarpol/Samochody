import { ROLES } from "./config.js";

export function canManageReservations(role) {
  return role === ROLES.ADMIN || role === ROLES.PORTIERNIA;
}

export function canEditReservation(profile, reservation) {
  if (!profile || !reservation) return false;
  return canManageReservations(profile.role) || reservation.user_id === profile.id;
}

export function canDeleteReservation(profile, reservation) {
  return canEditReservation(profile, reservation);
}
