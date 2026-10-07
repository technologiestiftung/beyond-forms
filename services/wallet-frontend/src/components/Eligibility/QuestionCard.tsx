import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { QuestionLayout } from "./QuestionLayout";
import { questionTipId } from "./questionTipId";

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
	const tipId = questionTipId(id);
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

	return (
		<QuestionLayout
			id={id}
			category={category}
			tip={tip}
			canSubmit={value !== undefined}
			onSubmit={onNext}
		>
			<fieldset
				className="w-full border-none p-0 m-0 flex flex-col gap-4 lg:gap-3"
				aria-describedby={tip ? tipId : undefined}
			>
				<legend
					ref={legendRef}
					id={legendId}
					tabIndex={-1}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-6 lg:mb-4 lg:text-h2"
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
							className="group flex gap-2 items-start justify-start w-full min-h-11 text-left cursor-pointer rounded-lg transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-blue-500 lg:gap-4 lg:items-center lg:min-h-12 lg:rounded-2xl lg:border-2 lg:border-brand-border lg:bg-white lg:px-5 lg:py-2.5 lg:hover:border-primary-blue-300 lg:hover:bg-brand-bg lg:has-checked:border-primary-blue-500 lg:has-checked:bg-primary-blue-50"
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
								className={`size-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors group-hover:border-primary-blue-300 lg:bg-white ${isChecked ? "border-primary-blue-500" : "border-brand-border"}`}
								aria-hidden="true"
							>
								{isChecked && (
									<span className="size-3 rounded-full bg-primary-blue-500" />
								)}
							</span>
							<span className="text-body-lg text-brand-grey leading-snug group-hover:text-brand-black lg:text-brand-black lg:group-has-checked:font-medium">
								{getLabel(option)}
							</span>
						</label>
					);
				})}
			</fieldset>
		</QuestionLayout>
	);
};
