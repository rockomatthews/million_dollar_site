/** POST /api/checkout-intents/:id/pay — opens or resumes the crypto checkout session. */
export async function requestCheckoutPaymentUrl(intentId: string): Promise<{
  checkoutUrl: string;
  message?: string;
  provider?: string;
}> {
  const response = await fetch(`/api/checkout-intents/${encodeURIComponent(intentId)}/pay`, {
    method: "POST",
  });
  const payload = (await response.json()) as {
    error?: string;
    checkoutUrl?: string;
    message?: string;
    provider?: string;
  };
  if (!response.ok || !payload.checkoutUrl) {
    throw new Error(payload.error ?? "Could not start payment session.");
  }
  return {
    checkoutUrl: payload.checkoutUrl,
    message: payload.message,
    provider: payload.provider,
  };
}
