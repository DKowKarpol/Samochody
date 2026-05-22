import { supabase } from "../config.js";
import { toDbLocalTimestamp, toLocalInputValue } from "../utils/date.js";

export async function fetchReservationsFromDb() {
  const { data, error } = await supabase
    .from("Reservations")
    .select("id,car_id,user_id,user_name,start_time,end_time,uwagi,Cars(name)")
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function checkReservationConflict(carId, startTime, endTime, excludeId = null) {
  let query = supabase
    .from("Reservations")
    .select("id")
    .eq("car_id", carId)
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length > 0;
}

export async function insertReservation(payload) {
  const { error } = await supabase.from("Reservations").insert(payload);
  if (error) throw error;
}

export async function updateReservationTimes(id, startDate, endDate) {
  const { error } = await supabase
    .from("Reservations")
    .update({
      start_time: toDbLocalTimestamp(toLocalInputValue(startDate)),
      end_time: toDbLocalTimestamp(toLocalInputValue(endDate)),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReservationFromDb(actorId, reservationId) {
  const { error } = await supabase.rpc("app_delete_reservation", {
    p_actor_id: actorId,
    p_reservation_id: reservationId,
  });
  if (error) throw error;
}
