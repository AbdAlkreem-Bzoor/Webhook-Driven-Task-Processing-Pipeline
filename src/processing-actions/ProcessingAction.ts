


export enum ProcessingActionType {
    Validate = "Validate",
    Transform = "Transform",
    Enrich = "Enrich",
}

export interface ProcessingActionResult {
    success: boolean;
    outputJson: string;
    reason?: string;
}

export interface IProcessingAction {
    readonly actionType: ProcessingActionType;
    execute(inputJson: string, configuration: string): ProcessingActionResult;
}
