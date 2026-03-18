// EnrichAction.ts
// Adds computed fields to the payload based on configuration.
//
// Configuration format (JSON string):
// {
//   "addTimestamp": true,           // Add "processedAt" ISO timestamp
//   "addHash": "fieldName",         // Add SHA-256 hash of specified field as "payloadHash"
//   "addUuid": true,                // Add "enrichmentId" UUID
//   "customFields": {               // Add custom static fields
//     "version": "1.0",
//     "source": "webhook"
//   }
// }
//
// If no configuration is provided, adds only processedAt timestamp.

import { createHash, randomUUID } from "crypto";
import {
    IProcessingAction,
    ProcessingActionResult,
    ProcessingActionType,
} from "./ProcessingAction.js";

interface EnrichConfig {
    addTimestamp?: boolean;
    addHash?: string;
    addUuid?: boolean;
    customFields?: Record<string, string | number | boolean>;
}

export class EnrichAction implements IProcessingAction {
    readonly actionType = ProcessingActionType.Enrich;

    execute(inputJson: string, configuration: string): ProcessingActionResult {
        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(inputJson);
        } catch {
            return { success: false, outputJson: inputJson, reason: "Invalid JSON payload." };
        }

        // Parse configuration with defaults
        let config: EnrichConfig = {
            addTimestamp: true,
        };
        if (configuration && configuration !== "{}") {
            try {
                const userConfig = JSON.parse(configuration);
                config = { ...config, ...userConfig };
            } catch {
                return { success: false, outputJson: inputJson, reason: "Invalid action configuration." };
            }
        }

        // Add timestamp
        if (config.addTimestamp) {
            payload.processedAt = new Date().toISOString();
        }

        // Add hash of specified field
        if (config.addHash && typeof config.addHash === "string") {
            const fieldValue = payload[config.addHash];
            if (fieldValue !== undefined) {
                const valueToHash = typeof fieldValue === "string"
                    ? fieldValue
                    : JSON.stringify(fieldValue);
                payload.payloadHash = createHash("sha256")
                    .update(valueToHash, "utf8")
                    .digest("hex");
            }
        }

        // Add UUID
        if (config.addUuid) {
            payload.enrichmentId = randomUUID();
        }

        // Add custom fields
        if (config.customFields && typeof config.customFields === "object") {
            for (const [key, value] of Object.entries(config.customFields)) {
                payload[key] = value;
            }
        }

        return { success: true, outputJson: JSON.stringify(payload) };
    }
}
