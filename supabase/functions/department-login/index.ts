import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

// Checks a department code and password, then returns a one-time token the
// browser exchanges for a normal Supabase session (verifyOtp with token_hash).
// Each department gets its own hidden auth user the first time it signs in.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, password } = await req.json();
    if (!code || !password) {
      return json({ error: "Enter your department code and password." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rows, error } = await supabase.rpc("verify_department_login", {
      p_code: String(code),
      p_password: String(password),
    });
    if (error) throw error;

    const dept = rows?.[0];
    if (!dept) {
      // Slow down guessing.
      await new Promise((r) => setTimeout(r, 1000));
      return json({ error: "Invalid department code or password." }, 401);
    }
    if (dept.hospital_status === "frozen") {
      return json({ error: "This hospital account is currently suspended. Please contact support." }, 403);
    }
    if (dept.hospital_status !== "active") {
      return json({ error: "This hospital account is not yet active." }, 403);
    }

    const email = `dept-${dept.department_id}@departments.bookmylocum.com`;

    if (!dept.auth_user_id) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { role: "department", department_id: dept.department_id, hospital_id: dept.hospital_id },
      });
      if (createError) throw createError;
      const { error: linkError } = await supabase
        .from("hospital_departments")
        .update({ auth_user_id: created.user.id })
        .eq("id", dept.department_id);
      if (linkError) throw linkError;
    }

    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError) throw linkError;

    return json({
      token_hash: link.properties.hashed_token,
      department: {
        id: dept.department_id,
        hospital_id: dept.hospital_id,
        department_name: dept.department_name,
        hospital_name: dept.hospital_name,
      },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
