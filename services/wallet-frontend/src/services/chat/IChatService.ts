export interface ChatToolCall {
	toolCallId: string;
	name: string;
	args: Record<string, unknown>;
}

export interface ChatStreamCallbacks {
	onResponse: (response: string) => void;
	onToolCall?: (call: ChatToolCall) => void;
	onDone: () => void;
	onError: (error: string) => void;
	signal?: AbortSignal;
}

export interface SendMessageOptions extends ChatStreamCallbacks {
	content: string;
}

export interface SendToolResultOptions extends ChatStreamCallbacks {
	toolCallId: string;
	content: string;
}

export interface IChatService {
	sendMessage(options: SendMessageOptions): Promise<void>;
	/** Answers a tool call the frontend handles, such as a chat card the user clicked. */
	sendToolResult(options: SendToolResultOptions): Promise<void>;
	newChat(): Promise<void>;
}
