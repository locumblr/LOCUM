import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = "re_BbmkKJsS_Dqf5LxwtW7RCEYfNuWuuhfsG";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    if (!body) {
      return new Response(JSON.stringify({ error: "Empty body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // duty_id: the locum_duties row to confirm
    // payment_ref: gateway transaction ID (pass "MANUAL" for manual confirmations)
    const { duty_id, payment_ref } = JSON.parse(body);

    if (!duty_id) {
      return new Response(JSON.stringify({ error: "duty_id is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch full duty details
    const { data: duty, error: dutyError } = await supabase
      .from("locum_duties")
      .select(`
        *,
        hospitals(hospital_name, email, phone, city),
        doctors(first_name, last_name, qualification, email),
        nurses(first_name, last_name, qualification, email)
      `)
      .eq("id", duty_id)
      .single();

    if (dutyError || !duty) {
      return new Response(JSON.stringify({ error: "Duty not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Update duty to confirmed + paid
    await supabase.from("locum_duties").update({
      booking_status: "confirmed",
      payment_status: "paid",
    }).eq("id", duty_id);

    // Build invoice data
    const hospital = duty.hospitals;
    const professional = duty.doctors || duty.nurses;
    const isNurse = duty.duty_type === "nurse";
    const professionalTitle = isNurse ? "" : "Dr. ";
    const grossPay = duty.gross_pay || duty.pay || 0;
    const platformFee = duty.platform_fee || 0;
    // Platform fee is GST-inclusive at 18%. Reverse-calculate the breakdown.
    const baseFee = Math.round(platformFee / 1.18);
    const gstAmount = platformFee - baseFee;

    // Invoice number: INV-YYYYMMDD-first6ofDutyId
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const invoiceNo = `INV-${ymd}-${duty_id.slice(0, 6).toUpperCase()}`;
    const invoiceDate = formatDate(now.toISOString().split("T")[0]);

    const invoiceHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f7fa;">
<div style="font-family:Arial,sans-serif;max-width:680px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#1e3a5f;padding:28px 36px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="color:white;font-size:26px;font-weight:700;letter-spacing:1px;">LOCUM</div>
      <div style="color:#a8c4e0;font-size:12px;margin-top:2px;">bookmylocum.com</div>
    </div>
    <div style="text-align:right;">
      <div style="color:white;font-size:18px;font-weight:700;">TAX INVOICE</div>
      <div style="color:#a8c4e0;font-size:13px;margin-top:4px;">${invoiceNo}</div>
      <div style="color:#a8c4e0;font-size:13px;">${invoiceDate}</div>
    </div>
  </div>

  <div style="padding:32px 36px;">

    <!-- Bill To -->
    <div style="margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:8px;">Bill To</div>
      <div style="font-size:17px;font-weight:700;color:#1e3a5f;">${hospital?.hospital_name || "Hospital"}</div>
      ${hospital?.city ? `<div style="font-size:13px;color:#666;margin-top:3px;">${hospital.city}</div>` : ""}
      <div style="font-size:13px;color:#666;margin-top:3px;">${hospital?.email || ""}</div>
    </div>

    <!-- Duty Details -->
    <div style="background:#f8f9fb;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:14px;">Duty Details</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="color:#888;padding:5px 0;width:140px;">Date</td>
          <td style="font-weight:600;color:#222;">${formatDate(duty.date)}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:5px 0;">Time</td>
          <td style="font-weight:600;color:#222;">${formatTime(duty.start_time)} – ${formatTime(duty.end_time)}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:5px 0;">Type</td>
          <td style="font-weight:600;color:#222;">${isNurse ? "Nurse" : "Doctor"}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:5px 0;">Specialty</td>
          <td style="font-weight:600;color:#222;">${duty.qualification}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:5px 0;">Professional</td>
          <td style="font-weight:600;color:#222;">${professionalTitle}${professional?.first_name || ""} ${professional?.last_name || ""}</td>
        </tr>
      </table>
    </div>

    <!-- Payment Summary -->
    <div style="margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:14px;">Payment Summary</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:9px 0;color:#555;border-bottom:1px solid #f0f0f0;">Gross Pay to Professional</td>
          <td style="padding:9px 0;text-align:right;color:#333;border-bottom:1px solid #f0f0f0;">Rs. ${grossPay.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#555;border-bottom:1px solid #f0f0f0;">Platform Service Charge</td>
          <td style="padding:9px 0;text-align:right;color:#333;border-bottom:1px solid #f0f0f0;">Rs. ${baseFee.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#555;border-bottom:1px solid #f0f0f0;">GST @ 18%</td>
          <td style="padding:9px 0;text-align:right;color:#333;border-bottom:1px solid #f0f0f0;">Rs. ${gstAmount.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td style="padding:12px 10px;font-weight:700;color:#1e3a5f;font-size:15px;background:#eef2f7;border-radius:6px 0 0 6px;">Total Platform Fee Paid</td>
          <td style="padding:12px 10px;text-align:right;font-weight:700;color:#1e3a5f;font-size:15px;background:#eef2f7;border-radius:0 6px 6px 0;">Rs. ${platformFee.toLocaleString("en-IN")}</td>
        </tr>
      </table>
      ${payment_ref && payment_ref !== "MANUAL"
        ? `<div style="margin-top:10px;font-size:12px;color:#888;">Payment Reference: ${payment_ref}</div>`
        : ""}
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #eee;padding-top:18px;font-size:12px;color:#aaa;line-height:1.6;">
      This is a computer-generated invoice and does not require a signature.<br>
      For queries, contact <a href="mailto:locum.blr@gmail.com" style="color:#1e3a5f;">locum.blr@gmail.com</a><br>
      LOCUM | bookmylocum.com
    </div>

  </div>
</div>
</body>
</html>`;

    // Send invoice to hospital
    if (hospital?.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "noreply@bookmylocum.com",
          reply_to: "locum.blr@gmail.com",
          to: hospital.email,
          subject: `Invoice ${invoiceNo} – Platform Fee Payment | LOCUM`,
          html: invoiceHtml,
        }),
      });
    }

    // In-app notification to the professional
    if (duty.booked_by) {
      await supabase.from("notifications").insert({
        user_id: duty.booked_by,
        title: "Duty Confirmed!",
        message: `Your ${duty.qualification} duty on ${formatDate(duty.date)} at ${hospital?.hospital_name || "the hospital"} is confirmed. Payment received.`,
      });
    }

    return new Response(JSON.stringify({ success: true, invoice_no: invoiceNo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
