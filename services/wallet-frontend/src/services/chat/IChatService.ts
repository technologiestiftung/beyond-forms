import type { A2uiMessage } from "../../a2ui/messages";
import type { EligibilityAnswerEvent } from "../../schemas/chat.schema";

export interface GuidedCheckContext {
	currentField?: string;
}

export interface SendMessageOptions {
	content: string;
	locale?: string;
	guidedCheck?: GuidedCheckContext;
	onResponse: (response: string) => void;
	onA2ui?: (message: A2uiMessage) => void;
	onEligibilityAnswer?: (answer: EligibilityAnswerEvent) => void;
	onDone: () => void;
	onError: (error: string) => void;
	signal?: AbortSignal;
}

export interface IChatService {
	sendMessage(options: SendMessageOptions): Promise<void>;
	newChat(): Promise<void>;
}
