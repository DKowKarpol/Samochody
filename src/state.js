import { startOfWeek } from "./utils/date.js";

export const appState = {
  profile: null,
  cars: [],
  reservations: [],
  realtimeChannel: null,
  weekStart: startOfWeek(new Date()),
};
