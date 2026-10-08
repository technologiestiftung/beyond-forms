import { z } from "zod";

/**
 * Schema for an individual NDJSON event from the /chat/stream endpoint.
 */
export const ChatStreamChunkSchema = z.object({
	type: z.enum(["token", "done", "error", "ui"]),
	content: z.string().optional(),
	conversation_id: z.string().optional(),
	component: z.string().optional(),
	props: z.record(z.string(), z.unknown()).optional(),
});

export type ChatStreamChunk = z.infer<typeof ChatStreamChunkSchema>;

/** Components the backend may ask the chat to render. */
export const ServerUiComponent = {
	ELIGIBILITY_CONSENT: "eligibility_consent",
	ELIGIBILITY_ANSWER: "eligibility_answer",
} as const;

/** Components the chat renders, from the backend or from the eligibility engine. */
export const ChatUiComponent = {
	ELIGIBILITY_CONSENT: "eligibility_consent",
	ELIGIBILITY_QUESTION: "eligibility_question",
	ELIGIBILITY_NOTED: "eligibility_noted",
	ELIGIBILITY_CONFIRM: "eligibility_confirm",
	ELIGIBILITY_RESULT: "eligibility_result",
} as const;

export type ChatUiComponent =
	(typeof ChatUiComponent)[keyof typeof ChatUiComponent];

export interface ChatUiEvent {
	component: string;
	props: Record<string, unknown>;
}

export interface ChatUi {
	component: ChatUiComponent;
	props: Record<string, unknown>;
}
