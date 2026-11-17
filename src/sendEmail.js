import { supabase } from "./supabaseClient";

// Emails go through the send-email edge function so the Resend API key stays server-side.
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, html },
    });
    if (error) console.error("Email send failed:", error);
  } catch (err) {
    console.error("Email send failed:", err);
  }
};
