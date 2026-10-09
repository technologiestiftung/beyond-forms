import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Check, Info } from "lucide-react";
import { z } from "zod/v3";
import {
	Catalog,
	CommonSchemas,
	type ComponentApi,
	type ComponentContext,
} from "@a2ui/web_core/v0_9";
import {
	createComponentImplementation,
	type ReactComponentImplementation,
} from "@a2ui/react/v0_9";
import * as Icons from "../components/ui/Icons";
import { KLARO_CATALOG_ID } from "./messages";

/**
 * The Klaro A2UI catalog: the components agents (the backend or the eligibility engine in the
 * browser) may use, styled like the rest of the app.
 */

const testId = (context: ComponentContext) =>
	`a2ui-${context.componentModel.id}`;

type ChildRef = string | { id: string; basePath?: string };

interface ViewProps<P> {
	props: P;
	buildChild: (id: string, basePath?: string) => React.ReactNode;
	context: ComponentContext;
}

/**
 * The A2UI packages bring their own Zod 3, and letting TypeScript infer props across the two
 * Zod copies exhausts the compiler. Props are therefore declared by hand next to each schema.
 */
const defineComponent = <P,>(
	name: string,
	shape: Record<string, unknown>,
	view: React.FC<ViewProps<P>>,
): ReactComponentImplementation =>
	createComponentImplementation(
		{
			name,
			schema: z.object(shape as z.ZodRawShape),
		} as unknown as ComponentApi,
		view as never,
	);

const Card = defineComponent<{ child: string }>(
	"Card",
	{ child: CommonSchemas.ComponentId },
	({ props, buildChild }) => (
		<div className="w-full max-w-[85%] rounded-2xl border border-brand-border-subtle bg-white p-5 shadow-cards">
			{buildChild(props.child)}
		</div>
	),
);

const childList = (
	children: ChildRef[],
	buildChild: (id: string, basePath?: string) => React.ReactNode,
) =>
	Array.isArray(children)
		? children.map((child) =>
				typeof child === "string" ? (
					<React.Fragment key={child}>{buildChild(child)}</React.Fragment>
				) : (
					<React.Fragment key={`${child.id}-${child.basePath}`}>
						{buildChild(child.id, child.basePath)}
					</React.Fragment>
				),
			)
		: null;

const Column = defineComponent<{
	children: ChildRef[];
	spacing?: "tight" | "normal";
}>(
	"Column",
	{
		children: CommonSchemas.ChildList,
		spacing: z.enum(["tight", "normal"]).optional(),
	},
	({ props, buildChild }) => (
		<div
			className={`flex flex-col ${props.spacing === "tight" ? "gap-1" : "gap-4"}`}
		>
			{childList(props.children, buildChild)}
		</div>
	),
);

const Row = defineComponent<{ children: ChildRef[] }>(
	"Row",
	{ children: CommonSchemas.ChildList },
	({ props, buildChild }) => (
		<div className="flex flex-wrap gap-2 empty:hidden">
			{childList(props.children, buildChild)}
		</div>
	),
);

const TEXT_STYLES = {
	eyebrow: "text-[13px] text-brand-grey",
	title: "text-[16px] font-bold text-brand-black leading-snug",
	body: "text-[14px] text-brand-black leading-[22px]",
	muted: "text-[14px] text-brand-grey",
} as const;

const Text = defineComponent<{
	text: string;
	variant?: keyof typeof TEXT_STYLES;
}>(
	"Text",
	{
		text: CommonSchemas.DynamicString,
		variant: z.enum(["eyebrow", "title", "body", "muted"]).optional(),
	},
	({ props }) => (
		<p className={TEXT_STYLES[props.variant ?? "body"]}>{props.text}</p>
	),
);

const Fact = defineComponent<{ label: string; text: string }>(
	"Fact",
	{
		label: CommonSchemas.DynamicString,
		text: CommonSchemas.DynamicString,
	},
	({ props }) => (
		<div className="text-[14px] leading-[22px]">
			<p className="font-semibold">{props.label}</p>
			<p>{props.text}</p>
		</div>
	),
);

const Hint = defineComponent<{ label: string; text: string }>(
	"Hint",
	{
		label: CommonSchemas.DynamicString,
		text: CommonSchemas.DynamicString,
	},
	({ props }) => (
		<div className="flex gap-2 rounded-xl bg-brand-bg p-3 text-[13px] text-brand-grey">
			<Info className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
			<p>
				<span className="font-semibold">{props.label}: </span>
				{props.text}
			</p>
		</div>
	),
);

const Chip = defineComponent<{
	label: string;
	action: () => void;
	variant?: "solid" | "outline";
}>(
	"Chip",
	{
		label: CommonSchemas.DynamicString,
		action: CommonSchemas.Action,
		variant: z.enum(["solid", "outline"]).optional(),
	},
	({ props, context }) => (
		<button
			type="button"
			data-testid={testId(context)}
			onClick={props.action}
			className={`w-fit rounded-full px-4 py-2 text-[14px] font-medium text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500 ${
				props.variant === "solid"
					? "bg-primary-green-500 text-primary-blue-500 hover:bg-primary-green-300"
					: "border-2 border-brand-border bg-white text-brand-black hover:border-primary-blue-300 hover:bg-brand-bg"
			}`}
		>
			{props.label}
		</button>
	),
);

const inputClassName =
	"h-11 w-full rounded-xl border-2 border-brand-border/30 bg-white px-3 text-base text-brand-black transition-colors hover:border-primary-blue-300 focus:outline-none focus:border-primary-blue-500";

const SendButton: React.FC<{ disabled: boolean; label: string }> = ({
	disabled,
	label,
}) => (
	<button
		type="submit"
		disabled={disabled}
		aria-label={label}
		className="size-11 shrink-0 flex items-center justify-center rounded-full bg-primary-blue-500 text-white transition-colors cursor-pointer hover:bg-primary-blue-500/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500"
	>
		<Icons.SendIcon className="size-5" />
	</button>
);

const AnswerInput = defineComponent<{
	inputType: "amount" | "date" | "text";
	value?: string;
	setValue: (value: string) => void;
	label: string;
	sendLabel: string;
	placeholder?: string;
	action: () => void;
}>(
	"AnswerInput",
	{
		inputType: z.enum(["amount", "date", "text"]),
		value: CommonSchemas.DynamicString,
		label: CommonSchemas.DynamicString,
		sendLabel: CommonSchemas.DynamicString,
		placeholder: CommonSchemas.DynamicString.optional(),
		action: CommonSchemas.Action,
	},
	({ props, context }) => {
		const value = props.value ?? "";
		const isAmount = props.inputType === "amount";

		return (
			<form
				className="flex items-center gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (value.trim()) {
						props.action();
					}
				}}
			>
				<div className={`relative w-full ${isAmount ? "max-w-60" : ""}`}>
					<input
						type={props.inputType === "date" ? "date" : "text"}
						inputMode={isAmount ? "numeric" : undefined}
						autoComplete="off"
						aria-label={props.label}
						placeholder={props.placeholder}
						data-testid={testId(context)}
						value={value}
						onChange={(e) =>
							props.setValue(
								isAmount ? e.target.value.replace(/\D/g, "") : e.target.value,
							)
						}
						className={`${inputClassName} ${isAmount ? "pr-10" : ""} ${props.inputType === "date" ? "max-w-60" : ""}`}
					/>
					{isAmount && (
						<span
							className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-grey"
							aria-hidden="true"
						>
							€
						</span>
					)}
				</div>
				<SendButton disabled={!value.trim()} label={props.sendLabel} />
			</form>
		);
	},
);

const ChildDatesInput = defineComponent<{
	value?: string[];
	setValue: (value: string[]) => void;
	itemLabel: string;
	addLabel: string;
	sendLabel: string;
	action: () => void;
}>(
	"ChildDatesInput",
	{
		value: CommonSchemas.DynamicStringList,
		itemLabel: CommonSchemas.DynamicString,
		addLabel: CommonSchemas.DynamicString,
		sendLabel: CommonSchemas.DynamicString,
		action: CommonSchemas.Action,
	},
	({ props }) => {
		const dates = props.value?.length ? props.value : [""];
		const setDate = (index: number, date: string) =>
			props.setValue(dates.map((d, i) => (i === index ? date : d)));

		return (
			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					props.action();
				}}
			>
				{dates.map((date, index) => (
					<label
						key={index}
						className="flex flex-col gap-1 text-[13px] text-brand-grey"
					>
						{`${props.itemLabel} ${index + 1}`}
						<input
							type="date"
							value={date}
							onChange={(e) => setDate(index, e.target.value)}
							className={`${inputClassName} max-w-60`}
						/>
					</label>
				))}
				<div className="flex items-center justify-between gap-2 max-w-73">
					<button
						type="button"
						onClick={() => props.setValue([...dates, ""])}
						className="w-fit text-[14px] text-primary-blue-400 underline cursor-pointer"
					>
						{props.addLabel}
					</button>
					<SendButton
						disabled={dates.some((d) => !d)}
						label={props.sendLabel}
					/>
				</div>
			</form>
		);
	},
);

const AnswerSummary = defineComponent<{
	question: string;
	answer: string;
	badge?: string;
}>(
	"AnswerSummary",
	{
		question: CommonSchemas.DynamicString,
		answer: CommonSchemas.DynamicString,
		badge: CommonSchemas.DynamicString.optional(),
	},
	({ props, context }) => (
		<div className="flex flex-col gap-2" data-testid={testId(context)}>
			<p className="text-[14px] text-brand-grey">{props.question}</p>
			<div className="flex justify-end">
				<div className="bg-primary-blue-500 text-white rounded-xl px-4 py-2 max-w-[85%] text-[14px] flex items-center gap-2">
					{props.answer}
					{props.badge && (
						<span className="rounded-full bg-primary-green-200 px-2 text-[12px] text-primary-blue-500">
							{props.badge}
						</span>
					)}
				</div>
			</div>
		</div>
	),
);

const Note = defineComponent<{ text: string }>(
	"Note",
	{ text: CommonSchemas.DynamicString },
	({ props, context }) => (
		<p
			data-testid={testId(context)}
			className="w-fit rounded-full bg-primary-green-200 px-3 py-1 text-[13px] text-primary-blue-500"
		>
			{props.text}
		</p>
	),
);

const DefinitionRow = defineComponent<{ label: string; value: string }>(
	"DefinitionRow",
	{
		label: CommonSchemas.DynamicString,
		value: CommonSchemas.DynamicString,
	},
	({ props }) => (
		<div className="flex justify-between gap-4 text-[14px]">
			<span className="text-brand-grey">{props.label}</span>
			<span className="font-semibold text-right">{props.value}</span>
		</div>
	),
);

const Table = defineComponent<{ columns: string[]; rows: string[][] }>(
	"Table",
	{
		columns: z.array(z.string()),
		rows: z.array(z.array(z.string())),
	},
	({ props, context }) => (
		<div
			className="w-full overflow-x-auto [contain:inline-size]"
			data-testid={testId(context)}
		>
			<table className="w-full border-collapse text-left text-[13px]">
				<thead>
					<tr>
						{props.columns.map((column) => (
							<th
								key={column}
								scope="col"
								className="border-b border-brand-border-subtle bg-brand-bg px-3 py-2 font-semibold"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{props.rows.map((row, rowIndex) => (
						<tr key={rowIndex}>
							{row.map((cell, cellIndex) => (
								<td
									key={cellIndex}
									className="border-b border-brand-border-subtle px-3 py-2 align-top"
								>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	),
);

/** Ticks are only for the user's own overview and are not sent anywhere. */
const Checklist = defineComponent<{
	items: { label: string; hint?: string }[];
}>(
	"Checklist",
	{
		items: z.array(
			z.object({ label: z.string(), hint: z.string().optional() }),
		),
	},
	({ props, context }) => {
		const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
		const toggle = (index: number) =>
			setChecked((current) => {
				const next = new Set(current);
				if (!next.delete(index)) {
					next.add(index);
				}
				return next;
			});

		return (
			<ul className="flex flex-col gap-2" data-testid={testId(context)}>
				{props.items.map((item, index) => (
					<li key={item.label}>
						<label className="flex cursor-pointer items-start gap-3 text-[14px]">
							<input
								type="checkbox"
								className="peer sr-only"
								checked={checked.has(index)}
								onChange={() => toggle(index)}
							/>
							<span
								aria-hidden="true"
								className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-brand-border bg-white text-white peer-checked:border-primary-blue-500 peer-checked:bg-primary-blue-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-blue-500"
							>
								<Check className="size-3.5" />
							</span>
							<span className="flex flex-col">
								<span
									className={
										checked.has(index) ? "line-through text-brand-grey" : ""
									}
								>
									{item.label}
								</span>
								{item.hint && (
									<span className="text-[13px] text-brand-grey">
										{item.hint}
									</span>
								)}
							</span>
						</label>
					</li>
				))}
			</ul>
		);
	},
);

const STATUS_STYLES = {
	likely: "bg-primary-green-300 text-primary-blue-500",
	possible: "bg-primary-blue-50 text-primary-blue-500",
	no: "bg-brand-bg text-brand-black",
} as const;

const BenefitItem = defineComponent<{
	title: string;
	status: keyof typeof STATUS_STYLES;
	statusLabel: string;
	reason: string;
}>(
	"BenefitItem",
	{
		title: CommonSchemas.DynamicString,
		status: z.enum(["likely", "possible", "no"]),
		statusLabel: CommonSchemas.DynamicString,
		reason: CommonSchemas.DynamicString,
	},
	({ props }) => (
		<div className="flex flex-col gap-1">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-[14px] font-semibold">{props.title}</span>
				<span
					className={`rounded-full px-2 py-0.5 text-[12px] ${STATUS_STYLES[props.status]}`}
				>
					{props.statusLabel}
				</span>
			</div>
			<p className="text-[13px] text-brand-grey">{props.reason}</p>
		</div>
	),
);

const Link = defineComponent<{ label: string; href: string }>(
	"Link",
	{
		label: CommonSchemas.DynamicString,
		href: z.string().startsWith("/"),
	},
	({ props }) => (
		<RouterLink
			to={props.href}
			className="w-fit text-[14px] text-primary-blue-400 underline"
		>
			{props.label}
		</RouterLink>
	),
);

const COMPONENTS: ReactComponentImplementation[] = [
	Card,
	Column,
	Row,
	Text,
	Fact,
	Hint,
	Chip,
	AnswerInput,
	ChildDatesInput,
	AnswerSummary,
	Note,
	DefinitionRow,
	Table,
	Checklist,
	BenefitItem,
	Link,
];

export const klaroCatalog = new Catalog(
	KLARO_CATALOG_ID,
	"v0.9",
	COMPONENTS,
	[],
);
