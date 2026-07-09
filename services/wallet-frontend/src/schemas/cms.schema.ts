import { z } from "zod";

export const TutorialStepContentSchema = z.object({
	title: z.string(),
	text: z.string(),
});

export const TutorialStepSchema = z.object({
	step_id: z.string(),
	image: z.string().nullish(),
	content: z.record(z.string(), TutorialStepContentSchema),
});

export const TutorialProgressResponseSchema = z.object({
	status: z.enum(["not_started", "in_progress", "completed"]),
	current_step: z.string().nullable().optional(),
});

export const TutorialResponseSchema = z.object({
	id: z.string().uuid(),
	slug: z.string(),
	title: z.record(z.string(), z.string()),
	subtitle: z.record(z.string(), z.string()).default({}),
	progress: TutorialProgressResponseSchema,
	steps: z.array(TutorialStepSchema),
});

export const TutorialProgressUpdatePayloadSchema = z.object({
	tutorial_id: z.string().uuid(),
	status: z.enum(["in_progress", "completed"]),
	current_step: z.string().nullable().optional(),
});

export type TutorialResponse = z.infer<typeof TutorialResponseSchema>;
export type TutorialStep = z.infer<typeof TutorialStepSchema>;
export type TutorialProgressUpdatePayload = z.infer<
	typeof TutorialProgressUpdatePayloadSchema
>;
export type TutorialStatus = TutorialResponse["progress"]["status"];
