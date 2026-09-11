import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { ChildEntry } from "../../schemas/benefitCheck.schema";
import { DateField } from "./DateField";
import { QuestionShell } from "./QuestionShell";
import type { QuestionHeader } from "./QuestionShell";
import { dateRangeErrorKey, isUsableDate } from "./dateRange";
import { todayIsoDate } from "../../utils/date";

interface ChildrenCardProps extends QuestionHeader {
	/** Templates carrying {{index}}; already translated by the caller. */
	addLabel: string;
	removeLabel: string;
	childLabel: string;
	value?: ChildEntry[];
	onChange: (value: ChildEntry[]) => void;
	onNext: () => void;
}

const withIndex = (template: string, index: number): string =>
	template.replace("{{index}}", String(index + 1));

export const ChildrenCard: React.FC<ChildrenCardProps> = ({
	id,
	question,
	category,
	tip,
	addLabel,
	removeLabel,
	childLabel,
	value,
	onChange,
	onNext,
}) => {
	const legendRef = useRef<HTMLLegendElement>(null);

	// One empty row to start, so a parent with one child types straight away.
	const [rows, setRows] = useState<string[]>(() =>
		value && value.length > 0 ? value.map((child) => child.dateOfBirth) : [""],
	);

	useEffect(() => {
		legendRef.current?.focus();
	}, [id]);

	const maxDate = useMemo(() => todayIsoDate(), []);

	const publish = (next: string[]) => {
		setRows(next);
		// Half-typed rows are dropped, so a date still being entered never becomes data.
		onChange(
			next
				.filter((dateOfBirth) => isUsableDate(dateOfBirth, maxDate))
				.map((dateOfBirth) => ({ dateOfBirth })),
		);
	};

	const isComplete =
		rows.length > 0 && rows.every((row) => isUsableDate(row, maxDate));

	return (
		<QuestionShell
			id={id}
			question={question}
			category={category}
			tip={tip}
			canAdvance={isComplete}
			onNext={onNext}
		>
			<fieldset className="w-full border-none p-0 m-0 flex flex-col gap-4">
				<legend
					ref={legendRef}
					tabIndex={-1}
					id={`${id}-legend`}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-2"
				>
					{question}
				</legend>

				<ul className="flex flex-col gap-4 w-full list-none p-0 m-0">
					{rows.map((dateOfBirth, index) => (
						<li key={index} className="flex flex-col gap-2">
							<label
								htmlFor={`${id}-child-${index}`}
								className="text-base text-brand-black"
							>
								{withIndex(childLabel, index)}
							</label>
							<div className="flex items-start gap-2">
								<DateField
									id={`${id}-child-${index}`}
									value={dateOfBirth || undefined}
									onChange={(iso) => {
										const next = [...rows];
										next[index] = iso;
										publish(next);
									}}
									onClear={() => {
										const next = [...rows];
										next[index] = "";
										publish(next);
									}}
									errorKey={(iso) => dateRangeErrorKey(iso, maxDate)}
									describedBy={`${id}-child-${index}-error`}
									className="flex-1"
									testId={`child-date-${index}`}
									errorTestId={`date-error-${index}`}
								/>
								{rows.length > 1 && (
									<button
										type="button"
										aria-label={withIndex(removeLabel, index)}
										data-testid={`remove-child-${index}`}
										onClick={() =>
											publish(rows.filter((_, position) => position !== index))
										}
										className="size-12 shrink-0 rounded-xl border-2 border-brand-border/30 flex items-center justify-center text-brand-grey"
									>
										<X className="size-5" aria-hidden="true" />
									</button>
								)}
							</div>
						</li>
					))}
				</ul>

				<button
					type="button"
					data-testid="add-child"
					onClick={() => publish([...rows, ""])}
					className="flex items-center gap-2 text-base font-bold text-brand-black self-start"
				>
					<Plus className="size-5" aria-hidden="true" />
					{addLabel}
				</button>
			</fieldset>
		</QuestionShell>
	);
};
