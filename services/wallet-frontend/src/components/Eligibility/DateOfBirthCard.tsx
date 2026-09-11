import React, { useEffect, useMemo, useRef } from "react";
import { DateField } from "./DateField";
import { QuestionShell } from "./QuestionShell";
import type { QuestionHeader } from "./QuestionShell";
import { dateRangeErrorKey } from "./dateRange";
import { todayIsoDate } from "../../utils/date";

interface DateOfBirthCardProps extends QuestionHeader {
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
	const maxDate = useMemo(() => todayIsoDate(), []);

	useEffect(() => {
		labelRef.current?.focus();
	}, [id]);

	return (
		<QuestionShell
			id={id}
			question={question}
			category={category}
			tip={tip}
			canAdvance={!!value}
			onNext={onNext}
		>
			<div className="w-full">
				<label
					ref={labelRef}
					htmlFor={`${id}-dob`}
					tabIndex={-1}
					id={`${id}-legend`}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block"
				>
					{question}
				</label>
				<DateField
					id={`${id}-dob`}
					value={value}
					onChange={onChange}
					onClear={onClear}
					errorKey={(iso) => dateRangeErrorKey(iso, maxDate)}
					ariaLabelledBy={`${id}-legend`}
					describedBy={`${id}-error`}
					className="w-full"
					testId="dob-date-input"
					errorTestId="date-error"
				/>
			</div>
		</QuestionShell>
	);
};
