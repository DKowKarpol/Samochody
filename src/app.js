import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://svqwesxzdmbbevxjzveo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-NhY37Y5Znl_eOM_Ov_nTw_KvPXUXUf";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
const reservationsEl = document.querySelector("#reservations");
const weekPrevBtn = document.querySelector("#week-prev");
const weekNextBtn = document.querySelector("#week-next");
const weekLabelEl = document.querySelector("#week-label");

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

let currentProfile = null;
let currentCars = [];
let currentReservations = [];
let realtimeChannel = null;
let currentWeekStart = startOfWeek(new Date());

const ROLES = {
  ADMIN: "admin",
  USER: "user",
  PORTIERNIA: "portiernia",
};

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#156039";
}

function toDbLocalTimestamp(value) {
  return `${value.replace("T", " ")}:00`;
}

function buildDateTime(dateValue, timeValue) {
  return `${dateValue}T${timeValue}`;
}

function parseDbTimestamp(value) {
  if (!value) return null;
  return new Date(value.replace(" ", "T"));
}

function toLocalInputValue(date) {
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + diff);
  return result;
}

function getMinBookingDate() {
  const min = new Date(Date.now() + 10 * 60 * 1000);
  min.setSeconds(0, 0);
  return min;
}

function setBookingMinNow() {
  const minDate = getMinBookingDate();
  const dateValue = toLocalInputValue(minDate).slice(0, 10);
  const timeValue = toLocalInputValue(minDate).slice(11, 16);
  startDateInput.min = dateValue;
  endDateInput.min = dateValue;
  if (!startDateInput.value) startDateInput.value = dateValue;
  if (!endDateInput.value) endDateInput.value = dateValue;
  if (!startInput.value) startInput.value = timeValue;
  if (!endInput.value) {
    const plusHour = new Date(minDate.getTime() + 60 * 60 * 1000);
    endInput.value = toLocalInputValue(plusHour).slice(11, 16);
    endDateInput.value = toLocalInputValue(plusHour).slice(0, 10);
  }
}

function renderWeekLabel() {
  const start = currentWeekStart;
  const end = addDays(start, 6);
  weekLabelEl.textContent = `${start.toLocaleDateString("pl-PL")} - ${end.toLocaleDateString("pl-PL")}`;
}

function normalizeLogin(login) {
  return (login || "").trim().toLowerCase();
}

function canManageReservations(role) {
  return role === ROLES.ADMIN || role === ROLES.PORTIERNIA;
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
  currentCars = data || [];
  carSelect.innerHTML = currentCars
    .map((car) => `<option value="${car.id}">${car.name}</option>`)
    .join("");
  renderCarsTable();
}

async function fetchReservations() {
  const { data, error } = await supabase
    .from("Reservations")
    .select("id,car_id,user_id,user_name,start_time,end_time,uwagi,Cars(name)")
    .order("start_time", { ascending: true });
  if (error) throw error;
  currentReservations = data || [];
  renderReservations();
}

async function fetchUsersForAdmin() {
  if (currentProfile?.role !== ROLES.ADMIN) return;
  const { data, error } = await supabase
    .from("users")
    .select("id,login,name,role")
    .order("login");
  if (error) throw error;
  renderUsersTable(data || []);
}

function renderReservations() {
  renderWeekLabel();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const pxPerHour = 34;
  const plannerHeight = 24 * pxPerHour;
  const minuteHeight = pxPerHour / 60;
  const cardHeight = 62;
  const cardGap = 4;

  const hourLabels = Array.from({ length: 25 }, (_, hour) => {
    const top = hour * pxPerHour;
    return `<div class="hour-label" style="top:${top}px">${String(hour).padStart(2, "0")}:00</div>`;
  }).join("");

  const dayLayouts = weekDays
    .map((day, dayIndex) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayReservations = currentReservations
        .map((r) => {
          const start = parseDbTimestamp(r.start_time);
          const end = parseDbTimestamp(r.end_time);
          if (!start || !end) return null;
          if (end <= dayStart || start >= dayEnd) return null;

          const clippedStart = start < dayStart ? dayStart : start;
          const clippedEnd = end > dayEnd ? dayEnd : end;
          return { reservation: r, clippedStart, clippedEnd, start, end };
        })
        .filter(Boolean)
        .sort((a, b) => a.clippedStart - b.clippedStart);

      const lanesEnd = [];
      const placed = dayReservations.map((item) => {
        let lane = 0;
        while (lane < lanesEnd.length && lanesEnd[lane] > item.clippedStart.getTime()) lane++;
        lanesEnd[lane] = item.clippedEnd.getTime();
        return { ...item, lane };
      });
      const laneCount = Math.max(1, lanesEnd.length);
      const dayWidth = 190 + Math.max(0, laneCount - 1) * 34;

      const items = placed
        .map((item) => {
          const r = item.reservation;
          const top =
            (item.clippedStart.getHours() * 60 + item.clippedStart.getMinutes()) * minuteHeight +
            item.lane * (cardHeight + cardGap);
          const height = cardHeight;
          const canEdit = canManageReservations(currentProfile.role);
          const canDelete =
            canManageReservations(currentProfile.role) || r.user_id === currentProfile.id;
          const ownClass = r.user_id === currentProfile.id ? "mine" : "";
          const details = encodeURIComponent(
            `${r.Cars?.name || r.car_id}\nUżytkownik: ${r.user_name}\nOd: ${item.start.toLocaleString("pl-PL")}\nDo: ${item.end.toLocaleString("pl-PL")}\nUwagi: ${r.uwagi || "-"}`
          );

          return `<div class="planner-item ${ownClass}" style="top:${top}px;height:${height}px" data-day="${dayIndex}" data-details="${details}">
            <div class="planner-item-title">${r.Cars?.name || r.car_id}</div>
            <div class="planner-item-meta">${r.user_name}</div>
            <div class="planner-item-meta">${item.start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} - ${item.end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</div>
            <div class="planner-item-meta">${r.uwagi || "-"}</div>
            <div class="planner-item-actions">
              ${canEdit ? `<button data-edit="${r.id}">Edytuj</button>` : ""}
              ${canDelete ? `<button data-del="${r.id}">Usuń</button>` : ""}
            </div>
          </div>`;
        })
        .join("");

      return {
        dayWidth,
        header: `<div class="planner-head-cell" style="min-width:${dayWidth}px">${day.toLocaleDateString("pl-PL", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        })}</div>`,
        body: `<div class="planner-day" style="height:${plannerHeight}px;min-width:${dayWidth}px">${items}</div>`,
      };
    });

  const headerDays = dayLayouts.map((d) => d.header).join("");
  const dayColumns = dayLayouts.map((d) => d.body).join("");
  const columnTemplate = `68px ${dayLayouts.map((d) => `${d.dayWidth}px`).join(" ")}`;

  reservationsEl.innerHTML = `
    <div class="planner-wrap">
      <div class="planner-head" style="grid-template-columns:${columnTemplate}">
        <div class="planner-head-time">Godzina</div>
        ${headerDays}
      </div>
      <div class="planner-body" style="height:${plannerHeight}px;grid-template-columns:${columnTemplate}">
        <div class="planner-hours" style="height:${plannerHeight}px">${hourLabels}</div>
        ${dayColumns}
      </div>
    </div>`;
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
                  ${u.id === currentProfile.id ? "-" : `<button data-del-user="${u.id}">Usuń</button>`}
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
        ${currentCars
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

async function createReservation(event) {
  event.preventDefault();
  const carId = Number(carSelect.value);
  if (!startDateInput.value || !startInput.value || !endDateInput.value || !endInput.value) {
    return setStatus("Wszystkie pola daty i czasu są wymagane.", true);
  }
  const startRaw = buildDateTime(startDateInput.value, startInput.value);
  const endRaw = buildDateTime(endDateInput.value, endInput.value);
  if (!carId || !startRaw || !endRaw) return setStatus("Wszystkie pola są wymagane.", true);
  if (startRaw >= endRaw) return setStatus("Data startu musi być wcześniejsza niż końca.", true);
  const minBookingDate = getMinBookingDate();
  if (new Date(startRaw) < minBookingDate) {
    return setStatus("Nie można rezerwować wstecz. Minimalny termin to teraz + 10 minut.", true);
  }

  const startTime = toDbLocalTimestamp(startRaw);
  const endTime = toDbLocalTimestamp(endRaw);
  const { data: conflict, error: conflictError } = await supabase
    .from("Reservations")
    .select("id")
    .eq("car_id", carId)
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1);
  if (conflictError) return setStatus(`Błąd sprawdzania konfliktu: ${conflictError.message}`, true);
  if (conflict?.length) {
    alert("To auto jest już zarezerwowane w wybranym czasie.");
    return;
  }

  const { error } = await supabase.from("Reservations").insert({
    car_id: carId,
    user_id: currentProfile.id,
    user_name: currentProfile.name || currentProfile.login,
    start_time: startTime,
    end_time: endTime,
    uwagi: notesInput.value.trim() || null,
  });
  if (error) return setStatus(`Błąd dodawania rezerwacji: ${error.message}`, true);
  await fetchReservations();
  setStatus("Rezerwacja zapisana.");
  reservationForm.reset();
  setBookingMinNow();
}

async function updateReservation(id) {
  const found = currentReservations.find((r) => r.id === id);
  if (!found) return;
  const currentStart = parseDbTimestamp(found.start_time);
  const currentEnd = parseDbTimestamp(found.end_time);
  const nextStart = prompt("Nowy start (YYYY-MM-DD HH:MM):", toLocalInputValue(currentStart).replace("T", " "));
  const nextEnd = prompt("Nowy koniec (YYYY-MM-DD HH:MM):", toLocalInputValue(currentEnd).replace("T", " "));
  if (!nextStart || !nextEnd) return;
  const startDate = new Date(nextStart.replace(" ", "T"));
  const endDate = new Date(nextEnd.replace(" ", "T"));
  if (startDate >= endDate) return setStatus("Start musi być wcześniej niż koniec.", true);

  const { error } = await supabase
    .from("Reservations")
    .update({
      start_time: toDbLocalTimestamp(toLocalInputValue(startDate)),
      end_time: toDbLocalTimestamp(toLocalInputValue(endDate)),
    })
    .eq("id", id);
  if (error) return setStatus(`Błąd edycji rezerwacji: ${error.message}`, true);
  setStatus("Rezerwacja zaktualizowana.");
}

async function deleteReservation(id) {
  const { error } = await supabase.rpc("app_delete_reservation", {
    p_actor_id: currentProfile.id,
    p_reservation_id: id,
  });
  if (error) return setStatus(`Błąd usuwania rezerwacji: ${error.message}`, true);
  await fetchReservations();
  setStatus("Rezerwacja usunięta.");
}

async function saveUserRole(userId, role) {
  const { error } = await supabase.rpc("app_set_user_role", {
    p_actor_id: currentProfile.id,
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
  if (!login || !name || !password || !role) return setStatus("Uzupełnij wszystkie pola nowego użytkownika.", true);

  const { error } = await supabase.rpc("app_create_user", {
    p_actor_id: currentProfile.id,
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
    p_actor_id: currentProfile.id,
    p_target_user_id: userId,
    p_password: password,
  });
  if (error) return setStatus(`Błąd zmiany hasła: ${error.message}`, true);
  setStatus("Hasło zmienione.");
}

async function deleteUser(userId) {
  if (!confirm("Na pewno usunąć użytkownika?")) return;
  const { error } = await supabase.rpc("app_delete_user", {
    p_actor_id: currentProfile.id,
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
  const isAdmin = currentProfile.role === ROLES.ADMIN;
  const canManage = canManageReservations(currentProfile.role);
  adminShortcuts.classList.toggle("hidden", !isAdmin);
  if (!canManage) setStatus("Masz rolę user - bez edycji/usuwania cudzych rezerwacji.");
}

function subscribeRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
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
  currentProfile = profile;
}

function clearSession() {
  localStorage.removeItem("cars_app_user_id");
  currentProfile = null;
}

async function bootstrapApp() {
  const profile = await loadSessionFromStorage();
  if (!profile) {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    return;
  }
  currentProfile = profile;
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  userInfoEl.textContent = `${currentProfile.name || "-"} (${currentProfile.login}) | rola: ${currentProfile.role}`;
  updateRoleViews();
  setBookingMinNow();
  await refreshData();
  subscribeRealtime();
}

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
reservationsEl.addEventListener("click", async (event) => {
  const details = event.target?.closest(".planner-item")?.dataset?.details;
  if (details && !event.target?.dataset?.edit && !event.target?.dataset?.del) {
    alert(decodeURIComponent(details));
    return;
  }
  const editId = Number(event.target?.dataset?.edit);
  const delId = Number(event.target?.dataset?.del);
  if (editId) await updateReservation(editId);
  if (delId) await deleteReservation(delId);
});

weekPrevBtn.addEventListener("click", () => {
  currentWeekStart = addDays(currentWeekStart, -7);
  renderReservations();
});

weekNextBtn.addEventListener("click", () => {
  currentWeekStart = addDays(currentWeekStart, 7);
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
setInterval(setBookingMinNow, 30_000);
await bootstrapApp();
