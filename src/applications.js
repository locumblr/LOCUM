import { supabase } from "./supabaseClient";

// Shared by the doctor, nurse and technician dashboards. Applying never locks a
// duty: the hospital reviews applicants, pays, and confirms one.

// { [duty_id]: status } for the signed-in professional's duty applications.
export const fetchMyApplications = async () => {
  const { data } = await supabase.from("duty_applications").select("duty_id, status");
  return Object.fromEntries((data || []).map(a => [a.duty_id, a.status]));
};

// Open cover requests the signed-in professional qualifies for (area only).
export const fetchOpenCoverRequests = async () => {
  const { data, error } = await supabase.rpc("get_open_cover_requests");
  if (error) console.error("Cover requests:", error);
  return data || [];
};

// Errors from the server actions are written for the user (e.g. "This duty is no longer open").
const run = async (fn, args) => {
  const { error } = await supabase.rpc(fn, args);
  if (error) { alert(error.message); return false; }
  return true;
};

export const applyToDuty = (dutyId) => run("apply_to_duty", { p_duty_id: dutyId });
export const withdrawApplication = (dutyId) => run("withdraw_application", { p_duty_id: dutyId });
export const applyForCover = (coverRequestId) => run("apply_for_cover", { p_cover_request_id: coverRequestId });
export const withdrawCoverApplication = (coverRequestId) =>
  run("withdraw_cover_application", { p_cover_request_id: coverRequestId });
