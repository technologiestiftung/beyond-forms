import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { QuestionShell } from "./QuestionShell";
import type { QuestionHeader } from "./QuestionShell";

interface QuestionCardProps extends QuestionHeader {
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

	useEffect(() => {
		legendRef.current?.focus();
	}, [id]);

	const getLabel = (option: string): string => {
		const customLabel = t(`questions.${id}.options.${option}`, {
			defaultValue: "",
		});
		return customLabel || t(option.toLowerCase());
	};

	return (
		<QuestionShell
			id={id}
			question={question}
			category={category}
			tip={tip}
			canAdvance={value !== undefined}
			onNext={onNext}
		>
			<fieldset
				className="w-full border-none p-0 m-0 flex flex-col gap-4"
				aria-describedby={tip ? `${id}-tip` : undefined}
			>
				<legend
					ref={legendRef}
					id={`${id}-legend`}
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
		</QuestionShell>
	);
};
