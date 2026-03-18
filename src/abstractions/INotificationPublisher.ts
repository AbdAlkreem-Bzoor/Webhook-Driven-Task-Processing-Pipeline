export interface INotificationPublisher {
    publishAsync(
        jobId: string,
        signal?: AbortSignal,
    ): Promise<void>;
}