import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { i18nKeys } from "../../../i18n/i18nKeys";
import {
	EligibilityEngine,
	type FlowNode,
	type NodeId,
} from "../../../store/EligibilityEngine";
import { useEligibilityStore } from "../../../store/useEligibilityStore";
import { useGuidedCheckStore } from "../../../store/useGuidedCheckStore";
import { useChatStore } from "../../../store/useChatStore";
import { answerFromCard } from "../../../store/guidedCheck";
import {
	EligibilityCheckSchema,
	type EligibilityCheck,
} from "../../../schemas/eligibility.schema";
import * as Icons from "../../ui/Icons";
import { ChatCard, ChipButton } from "./ChatCard";
import { useAnswerLabel } from "./useAnswerLabel";

type Field = keyof EligibilityCheck;

const inputClassName =
	"h-11 w-full rounded-xl border-2 border-brand-border/30 bg-white px-3 text-base text-brand-black transition-colors hover:border-primary-blue-300 focus:outline-none focus:border-primary-blue-500";

/** An open question card, or once answered on the card, the question with its answer. */
export const QuestionMessage: React.FC<{
	id: string;
	nodeId: NodeId;
	isActive: boolean;
	answered: boolean;
}> = ({ id, nodeId, isActive, answered }) => {
	const node = EligibilityEngine.getNode(nodeId);
	const field = node.key;
	const value = useEligibilityStore((s) =>
		field ? s.answers[field] : undefined,
	);
	const isProvisional = useGuidedCheckStore((s) =>
		field ? s.provisionalFields.includes(field) : false,
	);

	if (!field) {
		return null;
	}
	if (isActive) {
		return <OpenQuestion id={id} node={node} field={field} />;
	}
	if (!answered || value === undefined) {
		return null;
	}
	return (
		<AnsweredQuestion
			field={field}
			value={value}
			isProvisional={isProvisional}
		/>
	);
};

const AnsweredQuestion: React.FC<{
	field: Field;
	value: EligibilityCheck[Field];
	isProvisional: boolean;
}> = ({ field, value, isProvisional }) => {
	const { t } = useTranslation();
	const { t: tChat } = useTranslation("chat");
	const { answerLabel } = useAnswerLabel();

	return (
		<div className="flex flex-col gap-2" data-testid="guided-answered-question">
			<p className="text-[14px] text-brand-grey">
				{t(i18nKeys.eligibility.questionTitle(field))}
			</p>
			<div className="flex justify-end">
				<div className="bg-primary-blue-500 text-white rounded-xl px-4 py-2 max-w-[85%] text-[14px] flex items-center gap-2">
					{answerLabel(field, value)}
					{isProvisional && (
						<span className="rounded-full bg-primary-green-200 px-2 text-[12px] text-primary-blue-500">
							{tChat("guided.provisional")}
						</span>
					)}
				</div>
			</div>
		</div>
	);
};

const OpenQuestion: React.FC<{
	id: string;
	node: FlowNode;
	field: Field;
}> = ({ id, node, field }) => {
	const { t } = useTranslation();
	const { t: tChat } = useTranslation("chat");
	const showNextGuidedStep = useChatStore((s) => s.showNextGuidedStep);
	const markUiAnswered = useChatStore((s) => s.markUiAnswered);
	const sendMessage = useChatStore((s) => s.sendMessage);

	const submit = <K extends Field>(value: EligibilityCheck[K]) => {
		answerFromCard(field as K, value);
		markUiAnswered(id);
		showNextGuidedStep();
	};

	const renderInput = () => {
		switch (node.type) {
			case "number":
				return <NumberInput field={field} onSubmit={submit} />;
			case "date":
				return <DateInput field={field} onSubmit={submit} />;
			case "children":
				return <ChildrenInput onSubmit={submit} />;
			default:
				return <ChoiceInput field={field} node={node} onSubmit={submit} />;
		}
	};

	return (
		<ChatCard testId="guided-question-card">
			<div className="flex flex-col gap-1">
				<p className="text-[13px] text-brand-grey">
					{t(i18nKeys.eligibility.questionCategory(field))}
				</p>
				<h3 className="text-[16px] font-bold text-brand-black leading-snug">
					{t(i18nKeys.eligibility.questionTitle(field))}
				</h3>
			</div>
			<div className="flex gap-2 rounded-xl bg-brand-bg p-3 text-[13px] text-brand-grey">
				<Info className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
				<p>
					<span className="font-semibold">{tChat("guided.why")}: </span>
					{t(i18nKeys.eligibility.questionTip(field))}
				</p>
			</div>
			{renderInput()}
			<OwnAnswerInput onSubmit={(text) => void sendMessage(text)} />
			<ChipButton
				className="w-fit"
				onClick={() => void sendMessage(tChat("guided.unsure_message"))}
			>
				{tChat("guided.unsure")}
			</ChipButton>
		</ChatCard>
	);
};

/** Free text goes to the assistant, which may record it as a provisional answer. */
const OwnAnswerInput: React.FC<{ onSubmit: (text: string) => void }> = ({
	onSubmit,
}) => {
	const { t } = useTranslation("chat");
	const [draft, setDraft] = useState("");

	return (
		<form
			className="flex items-center gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				if (draft.trim()) {
					onSubmit(draft);
				}
			}}
		>
			<input
				type="text"
				autoComplete="off"
				placeholder={t("guided.own_answer")}
				aria-label={t("guided.own_answer")}
				data-testid="guided-own-answer"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				className={inputClassName}
			/>
			<SendButton disabled={!draft.trim()} />
		</form>
	);
};

type SubmitAnswer = <K extends Field>(value: EligibilityCheck[K]) => void;

const ChoiceInput: React.FC<{
	field: Field;
	node: FlowNode;
	onSubmit: SubmitAnswer;
}> = ({ field, node, onSubmit }) => {
	const { answerLabel } = useAnswerLabel();

	return (
		<div className="flex flex-wrap gap-2" role="group">
			{(node.options ?? []).map((option) => (
				<ChipButton
					key={option}
					data-testid={`guided-option-${option.toLowerCase()}`}
					onClick={() => onSubmit(option as EligibilityCheck[typeof field])}
				>
					{answerLabel(field, option as EligibilityCheck[typeof field])}
				</ChipButton>
			))}
		</div>
	);
};

const SendButton: React.FC<{ disabled: boolean }> = ({ disabled }) => {
	const { t } = useTranslation("chat");
	return (
		<button
			type="submit"
			disabled={disabled}
			aria-label={t("guided.send")}
			data-testid="guided-send"
			className="size-11 shrink-0 flex items-center justify-center rounded-full bg-primary-blue-500 text-white transition-colors cursor-pointer hover:bg-primary-blue-500/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500"
		>
			<Icons.SendIcon className="size-5" />
		</button>
	);
};

const NumberInput: React.FC<{ field: Field; onSubmit: SubmitAnswer }> = ({
	field,
	onSubmit,
}) => {
	const { t } = useTranslation();
	const [draft, setDraft] = useState("");
	const parsed = EligibilityCheckSchema.shape[field].safeParse(
		draft === "" ? undefined : Number(draft),
	);

	return (
		<form
			className="flex items-center gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				if (parsed.success) {
					onSubmit(parsed.data as EligibilityCheck[typeof field]);
				}
			}}
		>
			<div className="relative w-full max-w-60">
				<input
					type="text"
					inputMode="numeric"
					autoComplete="off"
					aria-label={t(i18nKeys.eligibility.questionTitle(field))}
					data-testid="guided-number-input"
					value={draft}
					onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
					className={`${inputClassName} pr-10`}
				/>
				<span
					className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-grey"
					aria-hidden="true"
				>
					€
				</span>
			</div>
			<SendButton disabled={!parsed.success} />
		</form>
	);
};

const DateInput: React.FC<{ field: Field; onSubmit: SubmitAnswer }> = ({
	field,
	onSubmit,
}) => {
	const { t } = useTranslation();
	const [draft, setDraft] = useState("");
	const parsed = EligibilityCheckSchema.shape[field].safeParse(draft);

	return (
		<form
			className="flex items-center gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				if (parsed.success) {
					onSubmit(parsed.data as EligibilityCheck[typeof field]);
				}
			}}
		>
			<input
				type="date"
				aria-label={t(i18nKeys.eligibility.questionTitle(field))}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				className={`${inputClassName} max-w-60`}
			/>
			<SendButton disabled={!parsed.success} />
		</form>
	);
};

const ChildrenInput: React.FC<{ onSubmit: SubmitAnswer }> = ({ onSubmit }) => {
	const { t } = useTranslation("chat");
	const [dates, setDates] = useState([""]);
	const parsed = EligibilityCheckSchema.shape.children.safeParse(
		dates.map((dateOfBirth) => ({ dateOfBirth })),
	);

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				if (parsed.success) {
					onSubmit<"children">(parsed.data);
				}
			}}
		>
			{dates.map((date, index) => (
				<label
					key={index}
					className="flex flex-col gap-1 text-[13px] text-brand-grey"
				>
					{t("guided.children.label", { index: index + 1 })}
					<input
						type="date"
						value={date}
						onChange={(e) =>
							setDates((current) =>
								current.map((d, i) => (i === index ? e.target.value : d)),
							)
						}
						className={`${inputClassName} max-w-60`}
					/>
				</label>
			))}
			<div className="flex items-center justify-between gap-2 max-w-73">
				<button
					type="button"
					onClick={() => setDates((current) => [...current, ""])}
					className="w-fit text-[14px] text-primary-blue-400 underline cursor-pointer"
				>
					{t("guided.children.add")}
				</button>
				<SendButton disabled={!parsed.success} />
			</div>
		</form>
	);
};
