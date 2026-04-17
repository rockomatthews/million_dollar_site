import crypto from "node:crypto";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function stableSortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(stableSortJson);
  }

  if (value && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const next: { [key: string]: JsonValue } = {};
    for (const key of sortedKeys) {
      next[key] = stableSortJson((value as { [key: string]: JsonValue })[key]);
    }
    return next;
  }

  return value;
}

export function verifyNowPaymentsSignature(rawBody: string, signature: string, ipnSecret: string): boolean {
  if (!signature || !ipnSecret) {
    return false;
  }

  let parsed: JsonValue;
  try {
    parsed = JSON.parse(rawBody) as JsonValue;
  } catch {
    return false;
  }

  const sorted = stableSortJson(parsed);
  const message = JSON.stringify(sorted);
  const digest = crypto.createHmac("sha512", ipnSecret).update(message).digest("hex");
  return digest === signature;
}
