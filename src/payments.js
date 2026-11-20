import { supabase } from "./supabaseClient";

// Edge function errors carry a JSON body with a message written for the user.
export const functionErrorMessage = async (error) => {
  try {
    const body = await error.context.json();
    if (body?.error) return body.error;
  } catch { /* not a JSON error body */ }
  return error.message || "Something went wrong. Please try again.";
};

const loadCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) { resolve(); return; }
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = resolve;
  script.onerror = () => reject(new Error("Could not open the payment window. Check your connection and try again."));
  document.body.appendChild(script);
});

// Pays a duty's platform fee through Razorpay Checkout. Resolves true once the
// server has verified Razorpay's signature and recorded the payment.
export const payPlatformFee = async (dutyId, prefill = {}) => {
  const { data: order, error } = await supabase.functions.invoke("create-payment-order", {
    body: { duty_id: dutyId },
  });
  if (error) { alert(await functionErrorMessage(error)); return false; }

  try {
    await loadCheckout();
  } catch (err) {
    alert(err.message);
    return false;
  }

  return new Promise((resolve) => {
    const checkout = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: "LOCUM",
      description: order.description,
      prefill,
      theme: { color: "#1e3a5f" },
      handler: async (response) => {
        const { error: verifyError } = await supabase.functions.invoke("verify-payment", { body: response });
        if (verifyError) { alert(await functionErrorMessage(verifyError)); resolve(false); return; }
        resolve(true);
      },
      modal: { ondismiss: () => resolve(false) },
    });
    checkout.on("payment.failed", (response) => {
      alert(response.error?.description || "The payment failed. No money was taken; please try again.");
    });
    checkout.open();
  });
};
