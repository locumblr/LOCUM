import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { qualification, title, body, url } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all doctors with matching qualification who have push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("qualification", qualification);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const VAPID_PUBLIC_KEY = "BIRe1rpvBs-8IxaS8YG9dvCm5Jk-12bP2GTtan-lRPKH7JaDQUwSCjVB9-CdCBBb66jREzWif0NW7XSk0YRVl9o";
    const VAPID_PRIVATE_KEY = "xZDppAE7KTdgJ-1gs0ysUKgk0l3QpbGKzu0f8Nkauzs";

    const results = await Promise.all(
      subscriptions.map(async ({ subscription }) => {
        const sub = JSON.parse(subscription);
        const payload = JSON.stringify({ title, body, url });

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "TTL": "86400",
          },
          body: payload,
        });

        return response.status;
      })
    );

    return new Response(JSON.stringify({ sent: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
