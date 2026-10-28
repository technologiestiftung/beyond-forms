import React from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { OptionCard } from "../ui/OptionCard";
import { PrimaryButton } from "../ui/PrimaryButton";
import {
	FormField,
	SelectField,
} from "../../views/Profile/personalData/fields";
import { COUNTRY_OPTIONS } from "../../constants/countries";
import type { ChatCardMessage } from "../../store/useChatStore";
import type {
	ChatCardInput,
	ChatCardValue,
} from "../../schemas/chatCard.schema";

type FormValues = Record<string, ChatCardValue | undefined>;

const INPUT_TYPES: Record<string, string> = {
	amount: "number",
	number: "number",
	date: "date",
	text: "text",
};

/** Turns the form state into the values the backend saves: filled-in inputs only. */
const toCardValues = (
	inputs: ChatCardInput[],
	values: FormValues,
): Record<string, ChatCardValue> | null => {
	const result: Record<string, ChatCardValue> = {};
	for (const input of inputs) {
		const value = values[input.field];
		if (value === undefined || value === "") {
			continue;
		}
		if (input.kind === "amount" || input.kind === "number") {
			const number = Number(String(value).replace(",", "."));
			if (Number.isNaN(number)) {
				return null;
			}
			result[input.field] = number;
		} else {
			result[input.field] =
				typeof value === "string" && input.kind === "text"
					? value.trim()
					: value;
		}
	}
	return result;
};

interface CardInputFieldProps {
	id: string;
	input: ChatCardInput;
	value: ChatCardValue | undefined;
	register: UseFormRegisterReturn;
	onChoose: (value: ChatCardValue) => void;
}

const CardInputField: React.FC<CardInputFieldProps> = ({
	id,
	input,
	value,
	register,
	onChoose,
}) => {
	const { t } = useTranslation("chat");
	if (input.kind === "choice") {
		return (
			<div
				role="radiogroup"
				aria-label={input.label}
				className="flex flex-col gap-2"
			>
				<span className="text-xs font-bold text-slate-500 uppercase tracking-wide text-left">
					{input.label}
				</span>
				{input.options?.map((option) => (
					<OptionCard
						key={String(option.value)}
						testIdPrefix={`chat-card-${input.field}`}
						id={String(option.value)}
						title={option.label}
						selected={value === option.value}
						onClick={() => onChoose(option.value)}
					/>
				))}
			</div>
		);
	}
	if (input.kind === "select") {
		const options =
			input.options_source === "countries"
				? COUNTRY_OPTIONS.map((country) => ({
						code: country.code,
						name: t(`profile:personal.countries.${country.code}`),
					}))
				: (input.options ?? []).map((option) => ({
						code: String(option.value),
						name: option.label,
					}));
		return (
			<SelectField
				id={id}
				label={input.label}
				register={register}
				placeholderText={`-- ${t("profile:common.please_select")} --`}
				options={options}
			/>
		);
	}
	return (
		<FormField
			id={id}
			label={input.label}
			type={INPUT_TYPES[input.kind]}
			register={register}
		/>
	);
};

interface ChatCardProps {
	message: ChatCardMessage;
	disabled: boolean;
	onSubmit: (values: Record<string, ChatCardValue>) => void;
}

export const ChatCard: React.FC<ChatCardProps> = ({
	message,
	disabled,
	onSubmit,
}) => {
	const { t } = useTranslation("chat");
	const { card, answer } = message;
	const { register, setValue, control, handleSubmit } = useForm<FormValues>({
		defaultValues: answer ?? {},
	});
	const values = useWatch({ control });
	const submitted = answer !== undefined;
	const cardValues = toCardValues(card.inputs, values);
	const canSubmit =
		!submitted &&
		!disabled &&
		cardValues !== null &&
		card.inputs.every(
			(input) => input.optional || cardValues[input.field] !== undefined,
		);

	const submit = handleSubmit((formValues) => {
		const result = toCardValues(card.inputs, formValues);
		if (result) {
			onSubmit(result);
		}
	});

	return (
		<form
			noValidate
			onSubmit={(event) => void submit(event)}
			data-testid={`chat-card-${card.card_id}`}
			className="w-full rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-4"
		>
			<div className="flex flex-col gap-1 text-left">
				<p className="text-base font-bold text-slate-900 leading-snug">
					{card.question}
				</p>
				{card.hint && (
					<p className="text-xs font-medium text-slate-500 leading-relaxed">
						{card.hint}
					</p>
				)}
			</div>

			<fieldset
				disabled={submitted || disabled}
				className="flex flex-col gap-4"
			>
				{card.inputs.map((input) => (
					<CardInputField
						key={input.field}
						id={`chat-card-${message.toolCallId}-${input.field}`}
						input={input}
						value={values[input.field]}
						register={register(input.field)}
						onChoose={(value) => setValue(input.field, value)}
					/>
				))}
			</fieldset>

			{!submitted && (
				<PrimaryButton type="submit" disabled={!canSubmit}>
					{t("card.submit")}
				</PrimaryButton>
			)}
			{submitted && (
				<p className="text-xs font-semibold text-slate-500 text-left">
					{t("card.saved")}
				</p>
			)}
		</form>
	);
};
