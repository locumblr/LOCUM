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

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

// Opens a Razorpay order for a duty's platform fee. The amount always comes
// from the duty row (20% of gross pay, set by a database trigger), never the browser.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ error: "Online payments are not set up yet. Please contact locum.blr@gmail.com." }, 503);
    }

    const { duty_id } = await req.json();
    if (!duty_id) return json({ error: "duty_id is required" }, 400);

    // Act as the signed-in hospital or department so the database's own rules apply.
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: overview, error: overviewError } = await asUser.rpc("get_duty_overview");
    if (overviewError) throw overviewError;
    const row = (overview || []).find((o: { duty_id: string }) => o.duty_id === duty_id);
    if (!row) return json({ error: "Duty not found." }, 404);
    if (row.paid) return json({ error: "This duty's fee has already been paid." }, 409);
    if (!row.applicants) return json({ error: "You can pay once at least one professional has applied." }, 409);

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: duty, error: dutyError } = await service
      .from("locum_duties")
      .select("id, hospital_id, qualification, date, platform_fee, booking_status")
      .eq("id", duty_id)
      .single();
    if (dutyError) throw dutyError;
    if (duty.booking_status !== "open") return json({ error: "This duty is no longer open." }, 409);

    const amountPaise = Math.round(Number(duty.platform_fee) * 100);
    if (!(amountPaise > 0)) return json({ error: "This duty has no platform fee set." }, 400);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `duty_${duty.id}`.slice(0, 40),
        notes: { duty_id: duty.id, hospital_id: duty.hospital_id },
      }),
    });
    const order = await res.json();
    if (!res.ok) throw new Error(order?.error?.description || "Could not start the payment.");

    const { error: insertError } = await service.from("duty_payments").insert({
      duty_id: duty.id,
      hospital_id: duty.hospital_id,
      amount_paise: amountPaise,
      razorpay_order_id: order.id,
    });
    if (insertError) throw insertError;

    return json({
      key_id: RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: amountPaise,
      currency: "INR",
      description: `Platform fee – ${duty.qualification} duty on ${duty.date}`,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
