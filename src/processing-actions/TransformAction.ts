
// Transforms and normalizes data in the payload based on configuration.
//
// Configuration format (JSON string):
// {
//   "trimStrings": true,           // Trim whitespace from all string fields
//   "lowercaseFields": ["email"],  // Fields to convert to lowercase
//   "uppercaseFields": ["code"],   // Fields to convert to uppercase
//   "roundNumbers": 2,             // Decimal places to round numbers to
//   "removeNulls": false           // Remove null/undefined fields
// }
//
// If no configuration is provided, applies sensible defaults:
// - Trims all strings
// - Rounds numbers to 2 decimal places

import {
    IProcessingAction,
    ProcessingActionResult,
    ProcessingActionType,
} from "./ProcessingAction.js";

interface TransformConfig {
    trimStrings?: boolean;
    lowercaseFields?: string[];
    uppercaseFields?: string[];
    roundNumbers?: number;
    removeNulls?: boolean;
}

export class TransformAction implements IProcessingAction {
    readonly actionType = ProcessingActionType.Transform;

    execute(inputJson: string, configuration: string): ProcessingActionResult {
        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(inputJson);
        } catch {
            return { success: false, outputJson: inputJson, reason: "Invalid JSON payload." };
        }

        let config: TransformConfig = {
            trimStrings: true,
            roundNumbers: 2,
        };
        if (configuration && configuration !== "{}") {
            try {
                const userConfig = JSON.parse(configuration);
                config = { ...config, ...userConfig };
            } catch {
                return { success: false, outputJson: inputJson, reason: "Invalid action configuration." };
            }
        }

        payload = this.transformObject(payload, config);

        return { success: true, outputJson: JSON.stringify(payload) };
    }

    private transformObject(
        obj: Record<string, unknown>,
        config: TransformConfig,
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
            if (config.removeNulls && (value === null || value === undefined)) {
                continue;
            }

            let transformedValue = value;

            if (typeof value === "string") {
                let strValue = value;

                if (config.trimStrings) {
                    strValue = strValue.trim();
                }

                if (config.lowercaseFields?.includes(key)) {
                    strValue = strValue.toLowerCase();
                }

                if (config.uppercaseFields?.includes(key)) {
                    strValue = strValue.toUpperCase();
                }

                transformedValue = strValue;
            }

            if (typeof value === "number" && config.roundNumbers !== undefined) {
                const factor = Math.pow(10, config.roundNumbers);
                transformedValue = Math.round(value * factor) / factor;
            }

            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                transformedValue = this.transformObject(value as Record<string, unknown>, config);
            }

            if (Array.isArray(value)) {
                transformedValue = value.map(item => {
                    if (typeof item === "object" && item !== null) {
                        return this.transformObject(item as Record<string, unknown>, config);
                    }
                    if (typeof item === "string" && config.trimStrings) {
                        return item.trim();
                    }
                    if (typeof item === "number" && config.roundNumbers !== undefined) {
                        const factor = Math.pow(10, config.roundNumbers);
                        return Math.round(item * factor) / factor;
                    }
                    return item;
                });
            }

            result[key] = transformedValue;
        }

        return result;
    }
}
