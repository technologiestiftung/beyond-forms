export interface SendMessageOptions {
	content: string;
	onResponse: (response: string) => void;
	onDone: () => void;
	onError: (error: string) => void;
	signal?: AbortSignal;
}

export interface IChatService {
	sendMessage(options: SendMessageOptions): Promise<void>;
	newChat(): Promise<void>;
}
