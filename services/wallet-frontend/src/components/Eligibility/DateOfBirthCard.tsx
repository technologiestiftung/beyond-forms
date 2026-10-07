import React, { useEffect, useMemo, useRef, useState } from "react";
import { QuestionLayout } from "./QuestionLayout";
import { questionTipId } from "./questionTipId";

interface DateOfBirthCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	value?: string;
	onChange: (value: string) => void;
	onClear: () => void;
	onNext: () => void;
}

export const DateOfBirthCard: React.FC<DateOfBirthCardProps> = ({
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
	const [draft, setDraft] = useState(value ?? "");
	const [prevValue, setPrevValue] = useState(value);
	const tipId = questionTipId(id);

	if (value !== prevValue) {
		setPrevValue(value);
		if (value && value !== draft) {
			setDraft(value);
		}
	}

	useEffect(() => {
		labelRef.current?.focus();
	}, [id]);

	const maxDate = useMemo(() => {
		return new Date().toISOString().slice(0, 10);
	}, []);

	const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const input = event.target;
		const isoValue = input.value;
		setDraft(isoValue);

		if (!isoValue || !input.validity.valid) {
			onClear();
			return;
		}

		onChange(isoValue);
	};

	return (
		<QuestionLayout
			id={id}
			category={category}
			tip={tip}
			canSubmit={!!value}
			onSubmit={onNext}
		>
			<div className="w-full">
				<label
					ref={labelRef}
					htmlFor={`${id}-dob`}
					tabIndex={-1}
					id={`${id}-legend`}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block lg:mb-4 lg:text-h2"
				>
					{question}
				</label>
				<input
					id={`${id}-dob`}
					type="date"
					aria-labelledby={`${id}-legend`}
					aria-describedby={tip ? tipId : undefined}
					data-testid="dob-date-input"
					value={draft}
					onChange={handleDateChange}
					min="1900-01-01"
					max={maxDate}
					className="h-12 w-full px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white transition-colors hover:border-primary-blue-300 focus:outline-none focus:border-brand-primary lg:h-14 lg:max-w-sm lg:rounded-2xl lg:border-brand-border-subtle lg:bg-brand-bg lg:px-5 lg:text-body-lg lg:focus:border-primary-blue-500 lg:focus:bg-white"
				/>
			</div>
		</QuestionLayout>
	);
};
