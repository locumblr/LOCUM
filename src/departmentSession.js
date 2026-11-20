import { supabase } from "./supabaseClient";
import { functionErrorMessage } from "./payments";

// Departments sign in with a code and password checked on the server, which
// returns a one-time token we exchange for a normal Supabase session.

const loadDepartment = async (userId) => {
  const { data: dept } = await supabase
    .from("hospital_departments")
    .select("id, hospital_id, department_name, department_code, fixed_pay")
    .eq("auth_user_id", userId)
    .single();
  if (!dept) return null;
  const { data: hospital } = await supabase
    .from("hospitals").select("hospital_name").eq("id", dept.hospital_id).single();
  return { ...dept, hospital_name: hospital?.hospital_name };
};

export const signInDepartment = async (code, password) => {
  const { data, error } = await supabase.functions.invoke("department-login", { body: { code, password } });
  if (error) return { error: await functionErrorMessage(error) };
  const { data: auth, error: otpError } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash, type: "magiclink",
  });
  if (otpError) return { error: otpError.message };
  const dept = await loadDepartment(auth.user.id);
  if (!dept) return { error: "Could not load your department. Please try again." };
  return { department: dept };
};

// The signed-in department, or null if this session isn't a department's.
export const currentDepartment = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "department") return null;
  return loadDepartment(user.id);
};

export const signOutDepartment = async () => {
  localStorage.removeItem("dept_session");
  await supabase.auth.signOut();
};
