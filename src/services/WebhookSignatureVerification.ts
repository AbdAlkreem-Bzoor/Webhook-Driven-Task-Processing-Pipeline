// WebhookSignatureVerification.ts

import { createHmac, timingSafeEqual } from "crypto";

export function isValidWebhookSignature(
    payload: string,
    secret: string,
    signature: string,
): boolean {
    const computedHash = createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");

    const computedSignature = `sha256=${computedHash}`;

    const a = Buffer.from(computedSignature, "utf8");
    const b = Buffer.from(signature, "utf8");

    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
}