export interface IMessageHandler {
    handleMessageAsync(
        jobId: string,
        signal?: AbortSignal,
    ): Promise<void>;
}