import type { ChatUiEvent } from "../../schemas/chat.schema";

export interface GuidedCheckContext {
	currentField?: string;
}

export interface SendMessageOptions {
	content: string;
	guidedCheck?: GuidedCheckContext;
	onResponse: (response: string) => void;
	onUi?: (event: ChatUiEvent) => void;
	onDone: () => void;
	onError: (error: string) => void;
	signal?: AbortSignal;
}

export interface IChatService {
	sendMessage(options: SendMessageOptions): Promise<void>;
	newChat(): Promise<void>;
}
