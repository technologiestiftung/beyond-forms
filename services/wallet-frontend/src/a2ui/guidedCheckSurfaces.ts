import i18n from "../i18n";
import { i18nKeys } from "../i18n/i18nKeys";
import type { FlowNode } from "../store/EligibilityEngine";
import { EligibilityEngine } from "../store/EligibilityEngine";
import { BenefitStatus, assessBenefits } from "../store/benefitRules";
import { useEligibilityStore } from "../store/useEligibilityStore";
import {
	ResultProfile,
	type EligibilityCheck,
} from "../schemas/eligibility.schema";
import { AppRoutes } from "../constants/routes";
import type { Field } from "../store/guidedCheck";
import {
	event,
	newSurface,
	updateComponents,
	type A2uiComponent,
	type A2uiMessage,
} from "./messages";

/** A2UI surfaces the eligibility engine shows in the chat. Texts are resolved here, like an agent would. */

const t = (key: string, options?: Record<string, unknown>) =>
	i18n.t(key, options);
const tChat = (key: string, options?: Record<string, unknown>) =>
	i18n.t(key, { ns: "chat", ...options });

export const answerLabel = <K extends Field>(
	field: K,
	value: EligibilityCheck[K],
): string => {
	const locale = i18n.language;
	if (typeof value === "number") {
		return `${value.toLocaleString(locale)} €`;
	}
	if (Array.isArray(value)) {
		return value
			.map((child) => new Date(child.dateOfBirth).toLocaleDateString(locale))
			.join(", ");
	}
	if (field === "dateOfBirth") {
		return new Date(value as string).toLocaleDateString(locale);
	}
	return t(`questions.${field}.options.${String(value)}`, {
		defaultValue: t(String(value).toLowerCase()),
	});
};

const fieldLabel = (field: Field) =>
	t(i18nKeys.eligibility.questionCategory(field));
const questionTitle = (field: Field) =>
	t(i18nKeys.eligibility.questionTitle(field));

const answerInput = (
	field: Field,
	node: FlowNode,
): { ids: string[]; components: A2uiComponent[] } => {
	const sendLabel = tChat("guided.send");
	switch (node.type) {
		case "number":
		case "date":
			return {
				ids: ["input"],
				components: [
					{
						id: "input",
						component: "AnswerInput",
						inputType: node.type === "number" ? "amount" : "date",
						value: { path: "/draft" },
						label: questionTitle(field),
						sendLabel,
						action: event("answer", { field, value: { path: "/draft" } }),
					},
				],
			};
		case "children":
			return {
				ids: ["input"],
				components: [
					{
						id: "input",
						component: "ChildDatesInput",
						value: { path: "/children" },
						itemLabel: tChat("guided.children.label"),
						addLabel: tChat("guided.children.add"),
						sendLabel,
						action: event("answer", { field, value: { path: "/children" } }),
					},
				],
			};
		default: {
			const options = node.options ?? [];
			return {
				ids: ["options", "own"],
				components: [
					{
						id: "options",
						component: "Row",
						children: options.map((option) => `option-${option}`),
					},
					...options.map((option) => ({
						id: `option-${option}`,
						component: "Chip",
						label: answerLabel(field, option as EligibilityCheck[typeof field]),
						action: event("answer", { field, value: option }),
					})),
					{
						id: "own",
						component: "AnswerInput",
						inputType: "text",
						value: { path: "/ownAnswer" },
						label: tChat("guided.own_answer"),
						placeholder: tChat("guided.own_answer"),
						sendLabel,
						action: event("send_text", { text: { path: "/ownAnswer" } }),
					},
				],
			};
		}
	}
};

export const questionSurface = (
	node: FlowNode & { key: Field },
): A2uiMessage[] => {
	const field = node.key;
	const input = answerInput(field, node);
	return newSurface("eligibility-question", [
		{ id: "root", component: "Card", child: "content" },
		{
			id: "content",
			component: "Column",
			children: ["heading", "hint", ...input.ids, "unsure"],
		},
		{
			id: "heading",
			component: "Column",
			spacing: "tight",
			children: ["category", "title"],
		},
		{
			id: "category",
			component: "Text",
			variant: "eyebrow",
			text: fieldLabel(field),
		},
		{
			id: "title",
			component: "Text",
			variant: "title",
			text: questionTitle(field),
		},
		{
			id: "hint",
			component: "Hint",
			label: tChat("guided.why"),
			text: t(i18nKeys.eligibility.questionTip(field)),
		},
		...input.components,
		{
			id: "unsure",
			component: "Chip",
			label: tChat("guided.unsure"),
			action: event("send_text", { text: tChat("guided.unsure_message") }),
		},
	]);
};

/** Replaces an answered question card with the question and the given answer. */
export const answeredQuestion = <K extends Field>(
	surfaceId: string,
	field: K,
	value: EligibilityCheck[K],
): A2uiMessage =>
	updateComponents(surfaceId, [
		{
			id: "root",
			component: "AnswerSummary",
			question: questionTitle(field),
			answer: answerLabel(field, value),
		},
	]);

export const notedSurface = <K extends Field>(
	field: K,
	value: EligibilityCheck[K],
): A2uiMessage[] =>
	newSurface("eligibility-noted", [
		{
			id: "root",
			component: "Note",
			text: tChat("guided.noted", {
				label: fieldLabel(field),
				value: answerLabel(field, value),
			}),
		},
	]);

export const confirmSurface = (fields: Field[]): A2uiMessage[] => {
	const answers = useEligibilityStore.getState().answers;
	return newSurface("eligibility-confirm", [
		{ id: "root", component: "Card", child: "content" },
		{
			id: "content",
			component: "Column",
			children: ["title", "description", "answers", "actions"],
		},
		{
			id: "title",
			component: "Text",
			variant: "title",
			text: tChat("guided.confirm.title"),
		},
		{
			id: "description",
			component: "Text",
			variant: "muted",
			text: tChat("guided.confirm.description"),
		},
		{
			id: "answers",
			component: "Column",
			children: fields.map((field) => `answer-${field}`),
		},
		...fields.map((field) => ({
			id: `answer-${field}`,
			component: "DefinitionRow",
			label: fieldLabel(field),
			value: answerLabel(field, answers[field] as EligibilityCheck[Field]),
		})),
		{ id: "actions", component: "Row", children: ["ok", "change"] },
		{
			id: "ok",
			component: "Chip",
			variant: "solid",
			label: tChat("guided.confirm.ok"),
			action: event("confirm_provisional", { fields }),
		},
		{
			id: "change",
			component: "Chip",
			label: tChat("guided.confirm.change"),
			action: event("answer_one_by_one", { fields }),
		},
	]);
};

/** Removes the buttons of a card once its choice is made. */
export const withoutActions = (surfaceId: string): A2uiMessage =>
	updateComponents(surfaceId, [
		{ id: "actions", component: "Row", children: [] },
	]);

const STATUS_ORDER = [
	BenefitStatus.LIKELY,
	BenefitStatus.POSSIBLE,
	BenefitStatus.NO,
];

export const resultSurface = (): A2uiMessage[] => {
	const answers = useEligibilityStore.getState().answers;
	const profile = EligibilityEngine.getOutcomeProfile(
		EligibilityEngine.getValidPath(answers),
	);

	if (profile === ResultProfile.NOT_ELIGIBLE) {
		return newSurface("eligibility-result", [
			{ id: "root", component: "Card", child: "content" },
			{ id: "content", component: "Column", children: ["title", "text"] },
			{
				id: "title",
				component: "Text",
				variant: "title",
				text: t(i18nKeys.eligibility.outcomeTitle("not_eligible")),
			},
			{
				id: "text",
				component: "Text",
				text: t(i18nKeys.eligibility.outcomeDesc("not_eligible")),
			},
		]);
	}

	const assessments = [...assessBenefits(answers)].sort(
		(a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
	);
	return newSurface("eligibility-result", [
		{ id: "root", component: "Card", child: "content" },
		{
			id: "content",
			component: "Column",
			children: ["title", ...assessments.map((a) => a.benefit), "details"],
		},
		{
			id: "title",
			component: "Text",
			variant: "title",
			text: t(i18nKeys.eligibility.outcomeTitle("eligible")),
		},
		...assessments.map(({ benefit, status, reason }) => ({
			id: benefit,
			component: "BenefitItem",
			title: t(`outcome.benefits.${benefit}`),
			status: status.toLowerCase(),
			statusLabel: t(`outcome.status.${status}`),
			reason: t(`outcome.reasons.${reason}`),
		})),
		{
			id: "details",
			component: "Link",
			label: tChat("guided.result.details"),
			href: AppRoutes.EligibilityResult,
		},
	]);
};
