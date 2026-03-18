
export interface JobSummaryResponse {
    id: string;
    pipelineId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
}

export interface DeliverySummary {
    subscriberId: string;
    subscriberUrl: string;
    totalAttempts: number;
    delivered: boolean;
    lastStatusCode: number;
    lastAttemptedAt: Date;
    lastError: string | null;
}

export interface JobDetailResponse {
    id: string;
    pipelineId: string;
    status: string;
    incomingPayload: string;
    processedPayload: string | null;
    deliveries: DeliverySummary[];
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
}

export interface DeliveryAttemptResponse {
    id: string;
    subscriberId: string;
    subscriberUrl: string;
    attemptNumber: number;
    httpStatusCode: number;
    success: boolean;
    errorMessage: string | null;
    attemptedAt: Date;
}

export interface PagedResponse<T> {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export function toPagedResponse<T>(
    items: T[],
    totalCount: number,
    page: number,
    pageSize: number,
): PagedResponse<T> {
    const totalPages = Math.ceil(totalCount / pageSize);
    return {
        items,
        totalCount,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
}