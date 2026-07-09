import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info } from "lucide-react";

interface QuestionCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	options: readonly string[];
	value?: string;
	onChange: (value: string) => void;
	onNext: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
	id,
	question,
	category,
	tip,
	options,
	value,
	onChange,
	onNext,
}) => {
	const { t } = useTranslation();
	const legendRef = useRef<HTMLLegendElement>(null);
	const tipId = `${id}-tip`;
	const legendId = `${id}-legend`;

	useEffect(() => {
		legendRef.current?.focus();
	}, [id]);

	const getLabel = (option: string): string => {
		const customLabel = t(`questions.${id}.options.${option}`, {
			defaultValue: "",
		});
		if (customLabel) {
			return customLabel;
		}
		return t(option.toLowerCase());
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (value !== undefined) {
			onNext();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-[360px]"
		>
			<div className="flex flex-col gap-6 w-full mb-8">
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
						id={tipId}
						className="bg-brand-bg border border-brand-border/40 rounded-xl p-4 flex flex-row gap-2 items-start"
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

				<fieldset
					className="w-full border-none p-0 m-0 flex flex-col gap-4"
					aria-describedby={tip ? tipId : undefined}
				>
					<legend
						ref={legendRef}
						id={legendId}
						tabIndex={-1}
						className="font-bold text-brand-black leading-snug focus:outline-none mb-6"
					>
						{question}
					</legend>

					{options.map((option) => {
						const inputId = `${id}-${option}`;
						const isChecked = value === option;

						return (
							<label
								key={option}
								htmlFor={inputId}
								data-testid={`option-${option.toLowerCase()}`}
								className="flex gap-2 items-start justify-start w-full min-h-11 text-left cursor-pointer rounded-lg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-blue-500"
							>
								<input
									type="radio"
									id={inputId}
									name={id}
									value={option}
									checked={isChecked}
									onChange={() => onChange(option)}
									className="sr-only"
								/>
								<span
									className="size-6 shrink-0 rounded-full border-2 border-brand-border flex items-center justify-center"
									aria-hidden="true"
								>
									{isChecked && (
										<span className="size-3 rounded-full bg-primary-blue-500" />
									)}
								</span>
								<span className="text-body-lg text-brand-grey leading-snug">
									{getLabel(option)}
								</span>
							</label>
						);
					})}
				</fieldset>
			</div>

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={value === undefined}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
