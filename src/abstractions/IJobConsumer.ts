


export interface IJobConsumer {
    subscribeAsync(signal?: AbortSignal): Promise<void>;
    unsubscribeAsync(signal?: AbortSignal): Promise<void>;
}