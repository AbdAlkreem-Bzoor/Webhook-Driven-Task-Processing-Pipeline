



export interface INotificationConsumer {
    subscribeAsync(signal?: AbortSignal): Promise<void>;
    unsubscribeAsync(signal?: AbortSignal): Promise<void>;
}