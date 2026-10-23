import { z } from "zod";

/**
 * Schema for an individual NDJSON event from the /chat/stream endpoint.
 * `a2ui` carries one A2UI v0.9 message, `eligibility_answer` a value the model took from free text.
 */
export const ChatStreamChunkSchema = z.object({
	type: z.enum(["token", "done", "error", "a2ui", "eligibility_answer"]),
	content: z.string().optional(),
	conversation_id: z.string().optional(),
	message: z.record(z.string(), z.unknown()).optional(),
	field: z.string().optional(),
	value: z.string().optional(),
});

export type ChatStreamChunk = z.infer<typeof ChatStreamChunkSchema>;

export interface EligibilityAnswerEvent {
	field: string;
	value: string;
}
