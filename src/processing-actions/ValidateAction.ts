
// Validates that the incoming payload is valid JSON and optionally matches
// a schema defined in the configuration.
//
// Configuration format (JSON string):
// {
//   "requiredFields": ["field1", "field2"],   // Optional: fields that must exist
//   "allowEmpty": false                       // Optional: whether to allow empty objects
// }
//
// If no configuration is provided, only validates that payload is valid JSON.

import {
    IProcessingAction,
    ProcessingActionResult,
    ProcessingActionType,
} from "./ProcessingAction.js";

interface ValidateConfig {
    requiredFields?: string[];
    allowEmpty?: boolean;
}

export class ValidateAction implements IProcessingAction {
    readonly actionType = ProcessingActionType.Validate;

    execute(inputJson: string, configuration: string): ProcessingActionResult {
        let payload: unknown;
        try {
            payload = JSON.parse(inputJson);
        } catch {
            return { success: false, outputJson: inputJson, reason: "Invalid JSON payload." };
        }

        if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
            return { success: false, outputJson: inputJson, reason: "Payload must be a JSON object." };
        }

        const obj = payload as Record<string, unknown>;

        let config: ValidateConfig = {};
        if (configuration && configuration !== "{}") {
            try {
                config = JSON.parse(configuration);
            } catch {
                return { success: false, outputJson: inputJson, reason: "Invalid action configuration." };
            }
        }

        if (!config.allowEmpty && Object.keys(obj).length === 0) {
            return { success: false, outputJson: inputJson, reason: "Payload cannot be empty." };
        }

        if (config.requiredFields && config.requiredFields.length > 0) {
            const missingFields: string[] = [];
            for (const field of config.requiredFields) {
                if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
                    missingFields.push(field);
                }
            }
            if (missingFields.length > 0) {
                return {
                    success: false,
                    outputJson: inputJson,
                    reason: `Missing required fields: ${missingFields.join(", ")}`,
                };
            }
        }

        return { success: true, outputJson: inputJson };
    }
}
