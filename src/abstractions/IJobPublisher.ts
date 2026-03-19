



export interface IJobPublisher {
    publishAsync(
        jobId: string,
        signal?: AbortSignal,
    ): Promise<void>;
}