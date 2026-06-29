import { startOfWeek } from "./utils/date.js";

export const appState = {
  cars: [],
  reservations: [],
  realtimeChannel: null,
  weekStart: startOfWeek(new Date()),
};
