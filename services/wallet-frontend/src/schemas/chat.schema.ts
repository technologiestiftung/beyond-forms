import { z } from "zod";

/**
 * Schema for an individual NDJSON event from the /chat/stream endpoint.
 */
export const ChatStreamChunkSchema = z.object({
	type: z.enum(["token", "done", "error"]),
	content: z.string().optional(),
	conversation_id: z.string().optional(),
});

export type ChatStreamChunk = z.infer<typeof ChatStreamChunkSchema>;
