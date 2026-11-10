import React, { useEffect, useRef, useState } from "react";
import { QuestionLayout } from "./QuestionLayout";
import { questionTipId } from "./questionTipId";

interface TextCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	value?: string;
	onChange: (value: string) => void;
	onClear: () => void;
	onNext: () => void;
}

export const TextCard: React.FC<TextCardProps> = ({
	id,
	question,
	category,
	tip,
	value,
	onChange,
	onClear,
	onNext,
}) => {
	const labelRef = useRef<HTMLLabelElement>(null);
	const tipId = questionTipId(id);
	const [draft, setDraft] = useState(value ?? "");

	useEffect(() => {
		labelRef.current?.focus();
	}, [id]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setDraft(event.target.value);
		const trimmed = event.target.value.trim();
		if (trimmed === "") {
			onClear();
			return;
		}
		onChange(trimmed);
	};

	return (
		<QuestionLayout
			id={id}
			category={category}
			tip={tip}
			canSubmit={value !== undefined}
			onSubmit={onNext}
		>
			<div className="w-full">
				<label
					ref={labelRef}
					htmlFor={`${id}-input`}
					tabIndex={-1}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block lg:mb-4 lg:text-h2"
				>
					{question}
				</label>
				<input
					id={`${id}-input`}
					type="text"
					autoComplete="off"
					aria-describedby={tip ? tipId : undefined}
					data-testid="text-input"
					value={draft}
					onChange={handleChange}
					className="h-12 w-full px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white transition-colors hover:border-primary-blue-300 focus:outline-none focus:border-brand-primary lg:h-14 lg:max-w-xl lg:rounded-2xl lg:border-brand-border-subtle lg:bg-brand-bg lg:px-5 lg:text-body-lg lg:focus:border-primary-blue-500 lg:focus:bg-white"
				/>
			</div>
		</QuestionLayout>
	);
};
