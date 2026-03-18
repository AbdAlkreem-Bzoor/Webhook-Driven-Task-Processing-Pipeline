
import { ProcessingActionType } from "../../processing-actions/ProcessingAction.js";

export interface ActionRequest {
    actionType: ProcessingActionType;
    configuration: string;
    name?: string;
    order?: number;
}

export interface CreatePipelineRequest {
    name: string;
    payloadSchema?: string;
    actions?: ActionRequest[];
    subscriberUrls: string[];
}

export interface UpdatePipelineRequest {
    name?: string;
    payloadSchema?: string;
    actions?: ActionRequest[];
    subscriberUrls?: string[];
}

export interface ActionResponse {
    id: string;
    order: number;
    actionType: ProcessingActionType;
    configuration: string;
    name: string | null;
}

export interface SubscriberResponse {
    id: string;
    url: string;
}

export interface PipelineResponse {
    id: string;
    name: string;
    sourceId: string;
    webhookUrl: string;
    payloadSchema: string | null;
    actions: ActionResponse[];
    subscribers: SubscriberResponse[];
    createdAt: Date;
    updatedAt: Date;
}
