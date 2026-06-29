import { supabase, ROLES } from "./config.js";
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
import {
  setupLongtermModal,
  syncLongtermCarOptions,
  setLongtermMinDates,
  closeLongtermModal,
} from "./planner/longterm.js";
import { canManageReservations } from "./permissions.js";
import { renderReservations, getReservationsContainer } from "./planner/render.js";
import {
  setupReservationModal,
  closeReservationModal,
  openReservationModal,
} from "./planner/modal.js";
import { setupPlannerInteractions } from "./planner/interactions.js";
import {
  checkReservationConflict,
  deleteReservationFromDb,
  fetchReservationsFromDb,
  insertReservation,
  updateReservationTimes,
} from "./services/reservations.js";

const statusEl = document.querySelector("#status");
const authSection = document.querySelector("#auth-section");
const appSection = document.querySelector("#app-section");
const userInfoEl = document.querySelector("#user-info");

const authForm = document.querySelector("#auth-form");
const loginInput = document.querySelector("#login");
const passwordInput = document.querySelector("#password");
const logoutBtn = document.querySelector("#logout-btn");

const reservationForm = document.querySelector("#reservation-form");
const carSelect = document.querySelector("#car-select");
const startDateInput = document.querySelector("#start-date");
const startInput = document.querySelector("#start-time");
const endDateInput = document.querySelector("#end-date");
const endInput = document.querySelector("#end-time");
const notesInput = document.querySelector("#notes");

const weekPrevBtn = document.querySelector("#week-prev");
const weekNextBtn = document.querySelector("#week-next");

const adminShortcuts = document.querySelector("#admin-shortcuts");
const usersModal = document.querySelector("#users-modal");
const carsModal = document.querySelector("#cars-modal");
const openUsersModalBtn = document.querySelector("#open-users-modal");
const closeUsersModalBtn = document.querySelector("#close-users-modal");
const openCarsModalBtn = document.querySelector("#open-cars-modal");
const closeCarsModalBtn = document.querySelector("#close-cars-modal");

const usersTableEl = document.querySelector("#users-table");
const userForm = document.querySelector("#user-form");
const newUserLoginInput = document.querySelector("#new-user-login");
const newUserNameInput = document.querySelector("#new-user-name");
const newUserPasswordInput = document.querySelector("#new-user-password");
const newUserRoleInput = document.querySelector("#new-user-role");

const carForm = document.querySelector("#car-form");
const newCarNameInput = document.querySelector("#new-car-name");
const carsTableEl = document.querySelector("#cars-table");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#156039";
}

function normalizeLogin(login) {
  return (login || "").trim().toLowerCase();
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

async function ensureInitialAdmin() {
  const { error } = await supabase.rpc("app_ensure_admin", {
    p_password: "admin123",
  });
  if (error) setStatus(`Błąd tworzenia konta admin: ${error.message}`, true);
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id,login,name,role")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function loginWithCredentials(login, password) {
  const { data, error } = await supabase.rpc("app_login", {
    p_login: normalizeLogin(login),
    p_password: password,
  });
  if (error) throw error;
  if (!data?.length) throw new Error("Nieprawidłowy login lub hasło.");
  return data[0];
}

async function fetchCars() {
  const { data, error } = await supabase.from("Cars").select("*").order("name");
  if (error) throw error;
  appState.cars = data || [];
  carSelect.innerHTML = appState.cars
    .map((car) => `<option value="${car.id}">${car.name}</option>`)
    .join("");
  syncLongtermCarOptions(appState.cars);
  renderCarsTable();
}

async function fetchReservations() {
  appState.reservations = await fetchReservationsFromDb();
  renderReservations();
}

async function fetchUsersForAdmin() {
  if (appState.profile?.role !== ROLES.ADMIN) return;
  const { data, error } = await supabase
    .from("users")
    .select("id,login,name,role")
    .order("login");
  if (error) throw error;
  renderUsersTable(data || []);
}

function renderUsersTable(users) {
  const roleOptions = [ROLES.USER, ROLES.PORTIERNIA, ROLES.ADMIN]
    .map((r) => `<option value="${r}">${r}</option>`)
    .join("");
  usersTableEl.innerHTML = `
    <table>
      <thead><tr><th>Login</th><th>Imię</th><th>Rola</th><th>Akcje</th></tr></thead>
      <tbody>
        ${users
          .map(
            (u) => `
              <tr>
                <td>${u.login}</td>
                <td>${u.name || "-"}</td>
                <td><select data-user-role="${u.id}">${roleOptions.replace(`value="${u.role}"`, `value="${u.role}" selected`)}</select></td>
                <td>
                  <button data-save-role="${u.id}">Rola</button>
                  <button data-pass="${u.id}">Hasło</button>
                  ${u.id === appState.profile.id ? "-" : `<button data-del-user="${u.id}">Usuń</button>`}
                </td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderCarsTable() {
  carsTableEl.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Nazwa</th><th>Akcja</th></tr></thead>
      <tbody>
        ${appState.cars
          .map(
            (car) => `
              <tr>
                <td>${car.id}</td>
                <td>${car.name}</td>
                <td><button data-del-car="${car.id}">Usuń</button></td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

async function saveReservationTimes(id, startDate, endDate) {
  const found = appState.reservations.find((r) => r.id === id);
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
  if (fromDate > toDate) {
    return setStatus("Data „Od dnia” musi być wcześniejsza lub równa „Do dnia”.", true);
  }
  const timeError = validateBookingTimes(dailyStart, dailyEnd);
  if (timeError) return setStatus(timeError, true);

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
        user_id: appState.profile.id,
        user_name: appState.profile.name || appState.profile.login,
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

  const startRaw = buildDateTime(startDateInput.value, startInput.value);
  const endRaw = buildDateTime(endDateInput.value, endInput.value);
  if (!carId || !startRaw || !endRaw) return setStatus("Wszystkie pola są wymagane.", true);
  if (startRaw >= endRaw) return setStatus("Data startu musi być wcześniejsza niż końca.", true);
  const minBookingDate = getMinBookingDate();
  if (new Date(startRaw) < minBookingDate) {
    return setStatus("Nie można rezerwować wstecz. Minimalny termin to teraz + 10 minut.", true);
  }

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
      user_id: appState.profile.id,
      user_name: appState.profile.name || appState.profile.login,
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

async function updateReservationPrompt(id) {
  const found = appState.reservations.find((r) => r.id === id);
  if (!found) return;
  const currentStart = parseDbTimestamp(found.start_time);
  const currentEnd = parseDbTimestamp(found.end_time);
  const nextStart = prompt(
    "Nowy start (YYYY-MM-DD HH:MM):",
    toLocalInputValue(currentStart).replace("T", " ")
  );
  const nextEnd = prompt(
    "Nowy koniec (YYYY-MM-DD HH:MM):",
    toLocalInputValue(currentEnd).replace("T", " ")
  );
  if (!nextStart || !nextEnd) return;
  const startDate = new Date(nextStart.replace(" ", "T"));
  const endDate = new Date(nextEnd.replace(" ", "T"));
  if (startDate >= endDate) return setStatus("Start musi być wcześniej niż koniec.", true);
  if (!isDateTimeWithinBookingWindow(startDate) || !isDateTimeWithinBookingWindow(endDate)) {
    return setStatus("Godziny muszą być w zakresie 06:00–22:00.", true);
  }
  await saveReservationTimes(id, startDate, endDate);
  closeReservationModal();
}

async function deleteReservation(id) {
  try {
    await deleteReservationFromDb(appState.profile.id, id);
    await fetchReservations();
    setStatus("Rezerwacja usunięta.");
  } catch (error) {
    setStatus(`Błąd usuwania rezerwacji: ${error.message}`, true);
  }
}

async function saveUserRole(userId, role) {
  const { error } = await supabase.rpc("app_set_user_role", {
    p_actor_id: appState.profile.id,
    p_target_user_id: userId,
    p_role: role,
  });
  if (error) return setStatus(`Błąd zapisu roli: ${error.message}`, true);
  setStatus("Rola zaktualizowana.");
  await fetchUsersForAdmin();
}

async function createUserByAdmin() {
  const login = normalizeLogin(newUserLoginInput.value);
  const name = newUserNameInput.value.trim();
  const password = newUserPasswordInput.value.trim();
  const role = newUserRoleInput.value;
  if (!login || !name || !password || !role) {
    return setStatus("Uzupełnij wszystkie pola nowego użytkownika.", true);
  }

  const { error } = await supabase.rpc("app_create_user", {
    p_actor_id: appState.profile.id,
    p_login: login,
    p_name: name,
    p_role: role,
    p_password: password,
  });
  if (error) return setStatus(`Błąd dodawania użytkownika: ${error.message}`, true);

  newUserLoginInput.value = "";
  newUserNameInput.value = "";
  newUserPasswordInput.value = "";
  newUserRoleInput.value = ROLES.USER;
  setStatus("Użytkownik dodany.");
  await fetchUsersForAdmin();
}

async function changePassword(userId) {
  const password = prompt("Nowe hasło (min. 6 znaków):");
  if (!password) return;
  if (password.length < 6) return setStatus("Hasło musi mieć min. 6 znaków.", true);
  const { error } = await supabase.rpc("app_set_user_password", {
    p_actor_id: appState.profile.id,
    p_target_user_id: userId,
    p_password: password,
  });
  if (error) return setStatus(`Błąd zmiany hasła: ${error.message}`, true);
  setStatus("Hasło zmienione.");
}

async function deleteUser(userId) {
  if (!confirm("Na pewno usunąć użytkownika?")) return;
  const { error } = await supabase.rpc("app_delete_user", {
    p_actor_id: appState.profile.id,
    p_target_user_id: userId,
  });
  if (error) return setStatus(`Błąd usuwania użytkownika: ${error.message}`, true);
  setStatus("Użytkownik usunięty.");
  await fetchUsersForAdmin();
}

async function addCar(event) {
  event.preventDefault();
  const name = newCarNameInput.value.trim();
  if (!name) return;
  const { error } = await supabase.from("Cars").insert({ name });
  if (error) return setStatus(`Błąd dodawania auta: ${error.message}`, true);
  newCarNameInput.value = "";
  setStatus("Auto dodane.");
  await fetchCars();
}

async function deleteCar(id) {
  const { error } = await supabase.from("Cars").delete().eq("id", id);
  if (error) return setStatus(`Błąd usuwania auta: ${error.message}`, true);
  setStatus("Auto usunięte.");
  await fetchCars();
}

async function refreshData() {
  await fetchCars();
  await fetchReservations();
  await fetchUsersForAdmin();
}

function updateRoleViews() {
  const isAdmin = appState.profile.role === ROLES.ADMIN;
  const canManage = canManageReservations(appState.profile.role);
  adminShortcuts.classList.toggle("hidden", !isAdmin);
  if (!canManage) setStatus("Masz rolę user - bez edycji/usuwania cudzych rezerwacji.");
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

async function loadSessionFromStorage() {
  const stored = localStorage.getItem("cars_app_user_id");
  if (!stored) return null;
  const userId = Number(stored);
  if (!userId) return null;
  return fetchProfile(userId);
}

function saveSession(profile) {
  localStorage.setItem("cars_app_user_id", String(profile.id));
  appState.profile = profile;
}

function clearSession() {
  localStorage.removeItem("cars_app_user_id");
  appState.profile = null;
}

async function bootstrapApp() {
  const profile = await loadSessionFromStorage();
  if (!profile) {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    return;
  }
  appState.profile = profile;
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  userInfoEl.textContent = `${appState.profile.name || "-"} (${appState.profile.login}) | rola: ${appState.profile.role}`;
  updateRoleViews();
  setBookingMinNow();
  await refreshData();
  subscribeRealtime();
}

const reservationsContainer = getReservationsContainer();

setupReservationModal({
  onEdit: updateReservationPrompt,
  onDelete: deleteReservation,
});

setupLongtermModal({
  onSubmit: createLongTermReservations,
  setDefaults: setBookingMinNow,
});

setupPlannerInteractions(reservationsContainer, {
  onTimesChange: saveReservationTimes,
  onOpenDetails: (id) => {
    const reservation = appState.reservations.find((r) => r.id === id);
    if (reservation) openReservationModal(reservation, appState.profile);
  },
  onRevert: renderReservations,
  setStatus,
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const login = loginInput.value.trim();
  const password = passwordInput.value.trim();
  if (!login || !password) return;
  try {
    const profile = await loginWithCredentials(login, password);
    saveSession(profile);
    setStatus("Zalogowano.");
    await bootstrapApp();
  } catch (error) {
    setStatus(`Błąd logowania: ${error.message}`, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  clearSession();
  setStatus("Wylogowano.");
  await bootstrapApp();
});

reservationForm.addEventListener("submit", createReservation);

weekPrevBtn.addEventListener("click", () => {
  appState.weekStart = addDays(appState.weekStart, -7);
  renderReservations();
});

weekNextBtn.addEventListener("click", () => {
  appState.weekStart = addDays(appState.weekStart, 7);
  renderReservations();
});

openUsersModalBtn.addEventListener("click", () => usersModal.classList.remove("hidden"));
closeUsersModalBtn.addEventListener("click", () => usersModal.classList.add("hidden"));
openCarsModalBtn.addEventListener("click", () => carsModal.classList.remove("hidden"));
closeCarsModalBtn.addEventListener("click", () => carsModal.classList.add("hidden"));

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createUserByAdmin();
});

usersTableEl.addEventListener("click", async (event) => {
  const userIdRole = Number(event.target?.dataset?.saveRole);
  const userIdPass = Number(event.target?.dataset?.pass);
  const userIdDelete = Number(event.target?.dataset?.delUser);
  if (userIdRole) {
    const select = usersTableEl.querySelector(`select[data-user-role="${userIdRole}"]`);
    await saveUserRole(userIdRole, select.value);
  }
  if (userIdPass) await changePassword(userIdPass);
  if (userIdDelete) await deleteUser(userIdDelete);
});

carForm.addEventListener("submit", addCar);
carsTableEl.addEventListener("click", async (event) => {
  const delCar = Number(event.target?.dataset?.delCar);
  if (delCar) await deleteCar(delCar);
});

await ensureInitialAdmin();
setBookingMinNow();
setInterval(() => {
  setBookingMinNow();
  if (appState.profile) renderReservations();
}, 30_000);
await bootstrapApp();