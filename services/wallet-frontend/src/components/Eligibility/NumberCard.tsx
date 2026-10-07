import React, { useEffect, useRef, useState } from "react";
import { QuestionLayout } from "./QuestionLayout";
import { questionTipId } from "./questionTipId";

interface NumberCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	value?: number;
	onChange: (value: number) => void;
	onClear: () => void;
	onNext: () => void;
}

export const NumberCard: React.FC<NumberCardProps> = ({
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
	const [draft, setDraft] = useState(value?.toString() ?? "");

	useEffect(() => {
		labelRef.current?.focus();
	}, [id]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const digits = event.target.value.replace(/\D/g, "");
		setDraft(digits);
		if (digits === "") {
			onClear();
			return;
		}
		onChange(Number(digits));
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
				<div className="relative lg:max-w-sm">
					<input
						id={`${id}-input`}
						type="text"
						inputMode="numeric"
						autoComplete="off"
						aria-describedby={tip ? tipId : undefined}
						data-testid="number-input"
						value={draft}
						onChange={handleChange}
						className="h-12 w-full pl-3 pr-10 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white transition-colors hover:border-primary-blue-300 focus:outline-none focus:border-brand-primary lg:h-14 lg:rounded-2xl lg:border-brand-border-subtle lg:bg-brand-bg lg:pl-5 lg:text-body-lg lg:focus:border-primary-blue-500 lg:focus:bg-white"
					/>
					<span
						className="absolute right-3 lg:right-5 top-1/2 -translate-y-1/2 text-brand-grey"
						aria-hidden="true"
					>
						€
					</span>
				</div>
			</div>
		</QuestionLayout>
	);
};
