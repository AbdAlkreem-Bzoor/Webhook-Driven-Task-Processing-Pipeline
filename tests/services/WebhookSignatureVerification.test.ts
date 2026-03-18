import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { isValidWebhookSignature } from "../../src/services/WebhookSignatureVerification.js";

describe("WebhookSignatureVerification", () => {
    const secret = "test-secret";
    const payload = '{"transactionId":"123","amount":100}';

    function generateValidSignature(data: string, key: string): string {
        const hash = createHmac("sha256", key)
            .update(data, "utf8")
            .digest("hex");
        return `sha256=${hash}`;
    }

    it("returns true for valid signature", () => {
        const signature = generateValidSignature(payload, secret);
        const result = isValidWebhookSignature(payload, secret, signature);
        expect(result).toBe(true);
    });

    it("returns false for invalid signature", () => {
        const result = isValidWebhookSignature(payload, secret, "sha256=invalidsig");
        expect(result).toBe(false);
    });

    it("returns false when signature is from different secret", () => {
        const signature = generateValidSignature(payload, "wrong-secret");
        const result = isValidWebhookSignature(payload, secret, signature);
        expect(result).toBe(false);
    });

    it("returns false when payload was modified", () => {
        const signature = generateValidSignature(payload, secret);
        const modifiedPayload = '{"transactionId":"456","amount":100}';
        const result = isValidWebhookSignature(modifiedPayload, secret, signature);
        expect(result).toBe(false);
    });

    it("returns false for empty signature", () => {
        const result = isValidWebhookSignature(payload, secret, "");
        expect(result).toBe(false);
    });

    it("returns false for signature without sha256= prefix", () => {
        const hash = createHmac("sha256", secret)
            .update(payload, "utf8")
            .digest("hex");
        const result = isValidWebhookSignature(payload, secret, hash);
        expect(result).toBe(false);
    });

    it("is case sensitive for signatures", () => {
        const signature = generateValidSignature(payload, secret);
        const upperSignature = signature.toUpperCase();
        const result = isValidWebhookSignature(payload, secret, upperSignature);
        expect(result).toBe(false);
    });

    it("handles empty payload", () => {
        const emptyPayload = "";
        const signature = generateValidSignature(emptyPayload, secret);
        const result = isValidWebhookSignature(emptyPayload, secret, signature);
        expect(result).toBe(true);
    });

    it("handles unicode payload", () => {
        const unicodePayload = '{"name":"日本語テスト","emoji":"🎉"}';
        const signature = generateValidSignature(unicodePayload, secret);
        const result = isValidWebhookSignature(unicodePayload, secret, signature);
        expect(result).toBe(true);
    });
});
