import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info } from "lucide-react";
import { localDateToday } from "../../schemas/eligibility.schema";

interface Child {
	dateOfBirth: string;
}

interface ChildrenCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	value?: Child[];
	onChange: (value: Child[]) => void;
	onClear: () => void;
	onNext: () => void;
}

export const ChildrenCard: React.FC<ChildrenCardProps> = ({
	id,
	question,
	category,
	tip,
	value,
	onChange,
	onClear,
	onNext,
}) => {
	const { t } = useTranslation();
	const legendRef = useRef<HTMLLegendElement>(null);
	const [drafts, setDrafts] = useState<string[]>(
		value?.map((child) => child.dateOfBirth) ?? [""],
	);

	useEffect(() => {
		legendRef.current?.focus();
	}, [id]);

	const maxDate = useMemo(() => localDateToday(), []);

	const update = (next: string[], allValid: boolean) => {
		setDrafts(next);
		if (next.length > 0 && allValid && next.every(Boolean)) {
			onChange(next.map((dateOfBirth) => ({ dateOfBirth })));
		} else {
			onClear();
		}
	};

	const allInputsValid = (form: HTMLFormElement | null, skipIndex = -1) =>
		!form ||
		Array.from(
			form.querySelectorAll<HTMLInputElement>("input[type=date]"),
		).every((input, i) => i === skipIndex || input.validity.valid);

	const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (value) {
			onNext();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-[360px]"
		>
			<fieldset
				className="w-full border-none p-0 m-0 flex flex-col gap-6 mb-8"
				aria-describedby={tip ? `${id}-tip` : undefined}
			>
				<div className="flex flex-col gap-3">
					<p className="text-body text-brand-grey">
						{t(i18nKeys.eligibility.title)}
					</p>
					<h1 className="text-xl font-bold text-brand-black leading-snug">
						{category}
					</h1>
				</div>

				{tip && (
					<div
						id={`${id}-tip`}
						className="bg-brand-bg border border-brand-border/40 rounded-xl p-4 flex gap-2 items-start"
					>
						<Info
							className="size-5 text-brand-grey shrink-0 mt-0.5"
							aria-hidden="true"
						/>
						<p className="text-base text-brand-grey leading-snug whitespace-pre-line">
							{tip}
						</p>
					</div>
				)}

				<legend
					ref={legendRef}
					tabIndex={-1}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-6"
				>
					{question}
				</legend>

				{drafts.map((draft, index) => {
					const inputId = `${id}-child-${index}`;
					const label = t("questions.children.child_label", {
						number: index + 1,
					});
					return (
						<div key={index} className="flex flex-col gap-2">
							<label htmlFor={inputId} className="text-brand-black">
								{label}
							</label>
							<div className="flex gap-3 items-center">
								<input
									id={inputId}
									type="date"
									data-testid={`child-date-input-${index}`}
									value={draft}
									min="1900-01-01"
									max={maxDate}
									onChange={(event) => {
										const next = [...drafts];
										next[index] = event.target.value;
										update(next, allInputsValid(event.target.form));
									}}
									className="h-12 w-full px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary"
								/>
								{drafts.length > 1 && (
									<button
										type="button"
										data-testid={`remove-child-${index}`}
										onClick={(event) =>
											update(
												drafts.filter((_, i) => i !== index),
												allInputsValid(event.currentTarget.form, index),
											)
										}
										className="shrink-0 min-h-11 text-primary-blue-400 underline hover:text-primary-blue-500"
									>
										{t("questions.children.remove", { number: index + 1 })}
									</button>
								)}
							</div>
						</div>
					);
				})}

				<button
					type="button"
					data-testid="add-child"
					onClick={() => update([...drafts, ""], false)}
					className="self-start min-h-11 text-primary-blue-400 font-medium underline hover:text-primary-blue-500"
				>
					{t("questions.children.add")}
				</button>
			</fieldset>

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={!value}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
