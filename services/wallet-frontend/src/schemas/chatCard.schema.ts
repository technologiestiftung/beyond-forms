import { z } from "zod";

const ChatCardValueSchema = z.union([z.string(), z.number(), z.boolean()]);

/** One input of a chat card; `field` is the backend's profile column. */
const ChatCardInputSchema = z.object({
	field: z.string(),
	kind: z.enum(["choice", "select", "amount", "number", "date", "text"]),
	label: z.string(),
	optional: z.boolean().optional(),
	options: z
		.array(z.object({ value: ChatCardValueSchema, label: z.string() }))
		.optional(),
	options_source: z.enum(["countries"]).optional(),
});

/** The card the backend builds for a `show_card` call. */
export const ChatCardViewSchema = z.object({
	card_id: z.string(),
	question: z.string(),
	hint: z.string().optional(),
	inputs: z.array(ChatCardInputSchema).min(1),
});

export type ChatCardValue = z.infer<typeof ChatCardValueSchema>;
export type ChatCardInput = z.infer<typeof ChatCardInputSchema>;
export type ChatCardView = z.infer<typeof ChatCardViewSchema>;
