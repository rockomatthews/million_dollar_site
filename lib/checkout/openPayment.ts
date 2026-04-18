/** POST /api/checkout-intents/:id/pay — opens or resumes the crypto checkout session. */
export async function requestCheckoutPaymentUrl(intentId: string): Promise<{
  /** Null when provider is unconfigured (no NOWPayments key); use resumeUrl to bookmark this flow. */
  checkoutUrl: string | null;
  resumeUrl?: string;
  message?: string;
  provider?: string;
}> {
  const response = await fetch(`/api/checkout-intents/${encodeURIComponent(intentId)}/pay`, {
    method: "POST",
  });
  const payload = (await response.json()) as {
    error?: string;
    checkoutUrl?: string | null;
    resumeUrl?: string;
    message?: string;
    provider?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not start payment session.");
  }
  if (payload.provider === "unconfigured") {
    return {
      checkoutUrl: null,
      resumeUrl: payload.resumeUrl,
      message: payload.message,
      provider: payload.provider,
    };
  }
  if (!payload.checkoutUrl) {
    throw new Error(payload.error ?? "Could not start payment session.");
  }
  return {
    checkoutUrl: payload.checkoutUrl,
    resumeUrl: payload.resumeUrl,
    message: payload.message,
    provider: payload.provider,
  };
}
