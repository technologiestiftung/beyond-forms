import { z } from "zod";

/**
 * A view the model composes with the `show_view` tool. The backend validates it as well;
 * this schema makes sure the chat only renders components it knows.
 */
export type ViewComponent =
	| {
			component: "Column";
			children: ViewComponent[];
			spacing?: "tight" | "normal";
	  }
	| { component: "Row"; children: ViewComponent[] }
	| {
			component: "Text";
			text: string;
			variant?: "eyebrow" | "title" | "body" | "muted";
	  }
	| { component: "Fact"; label: string; text: string }
	| { component: "Note"; text: string }
	| { component: "DefinitionRow"; label: string; value: string }
	| { component: "Table"; columns: string[]; rows: string[][] }
	| { component: "Checklist"; items: { label: string; hint?: string }[] }
	| {
			component: "Chip";
			label: string;
			sendText: string;
			variant?: "solid" | "outline";
	  }
	| { component: "Link"; label: string; href: string };

const internalPath = z
	.string()
	.refine((href) => href.startsWith("/") && !href.startsWith("//"));

export const ViewComponentSchema: z.ZodType<ViewComponent> = z.lazy(() =>
	z.discriminatedUnion("component", [
		z.object({
			component: z.literal("Column"),
			children: z.array(ViewComponentSchema),
			spacing: z.enum(["tight", "normal"]).optional(),
		}),
		z.object({
			component: z.literal("Row"),
			children: z.array(ViewComponentSchema),
		}),
		z.object({
			component: z.literal("Text"),
			text: z.string(),
			variant: z.enum(["eyebrow", "title", "body", "muted"]).optional(),
		}),
		z.object({
			component: z.literal("Fact"),
			label: z.string(),
			text: z.string(),
		}),
		z.object({ component: z.literal("Note"), text: z.string() }),
		z.object({
			component: z.literal("DefinitionRow"),
			label: z.string(),
			value: z.string(),
		}),
		z.object({
			component: z.literal("Table"),
			columns: z.array(z.string()),
			rows: z.array(z.array(z.string())),
		}),
		z.object({
			component: z.literal("Checklist"),
			items: z.array(
				z.object({ label: z.string(), hint: z.string().optional() }),
			),
		}),
		z.object({
			component: z.literal("Chip"),
			label: z.string(),
			sendText: z.string(),
			variant: z.enum(["solid", "outline"]).optional(),
		}),
		z.object({
			component: z.literal("Link"),
			label: z.string(),
			href: internalPath,
		}),
	]),
);

export const GeneratedViewSchema = z.array(ViewComponentSchema).min(1);
