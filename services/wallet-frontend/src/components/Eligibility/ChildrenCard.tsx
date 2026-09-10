import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info, Plus, X } from "lucide-react";
import type { ChildEntry } from "../../schemas/benefitCheck.schema";
import {
	EARLIEST_BIRTHDATE,
	dateRangeErrorKey,
	isUsableDate,
	todayIso,
} from "./dateRange";

interface ChildrenCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
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
	const { t } = useTranslation();
	const legendRef = useRef<HTMLLegendElement>(null);

	// One empty row to start, so a parent with one child types straight away.
	const [rows, setRows] = useState<string[]>(() =>
		value && value.length > 0 ? value.map((child) => child.dateOfBirth) : [""],
	);

	// Which row the cursor is in, so its message can wait until the row is left.
	const [focusedRow, setFocusedRow] = useState<number | null>(null);

	useEffect(() => {
		legendRef.current?.focus();
	}, [id]);

	const maxDate = useMemo(() => todayIso(), []);

	const publish = (next: string[]) => {
		setRows(next);
		// Empty and half-typed rows are dropped, so neither an accidentally added row nor
		// a date still being typed becomes data.
		onChange(
			next
				.filter((dateOfBirth) => isUsableDate(dateOfBirth, maxDate))
				.map((dateOfBirth) => ({ dateOfBirth })),
		);
	};

	const isComplete =
		rows.length > 0 && rows.every((row) => isUsableDate(row, maxDate));

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (isComplete) {
			onNext();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-[360px]"
		>
			<fieldset className="w-full border-none p-0 m-0 flex flex-col gap-6 mb-8">
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
					id={`${id}-legend`}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-2"
				>
					{question}
				</legend>

				<ul className="flex flex-col gap-4 w-full list-none p-0 m-0">
					{rows.map((dateOfBirth, index) => {
						const errorKey =
							focusedRow === index
								? undefined
								: dateRangeErrorKey(dateOfBirth, maxDate);
						const errorId = `${id}-child-${index}-error`;
						const describedBy =
							[tip ? `${id}-tip` : null, errorKey ? errorId : null]
								.filter(Boolean)
								.join(" ") || undefined;

						return (
							<li key={index} className="flex flex-col gap-2">
								<label
									htmlFor={`${id}-child-${index}`}
									className="text-base text-brand-black"
								>
									{withIndex(childLabel, index)}
								</label>
								<div className="flex items-center gap-2">
									<input
										id={`${id}-child-${index}`}
										type="date"
										aria-describedby={describedBy}
										aria-invalid={errorKey !== undefined}
										data-testid={`child-date-${index}`}
										value={dateOfBirth}
										min={EARLIEST_BIRTHDATE}
										max={maxDate}
										onFocus={() => setFocusedRow(index)}
										onBlur={() => setFocusedRow(null)}
										/*
										 * The row mirrors the field verbatim. Writing a corrected
										 * value back mid-typing makes React reset the node, and a
										 * date input loses its day and month segments when that
										 * happens: typing the first digit of the year completes the
										 * value as year 0001, below `min`, and the entry vanishes.
										 */
										onChange={(event) => {
											const next = [...rows];
											next[index] = event.target.value;
											publish(next);
										}}
										className={`h-12 flex-1 px-3 rounded-xl border-2 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary ${
											errorKey ? "border-red-400" : "border-brand-border/30"
										}`}
									/>
									{rows.length > 1 && (
										<button
											type="button"
											aria-label={withIndex(removeLabel, index)}
											data-testid={`remove-child-${index}`}
											onClick={() =>
												publish(
													rows.filter((_, position) => position !== index),
												)
											}
											className="size-12 shrink-0 rounded-xl border-2 border-brand-border/30 flex items-center justify-center text-brand-grey"
										>
											<X className="size-5" aria-hidden="true" />
										</button>
									)}
								</div>
								{errorKey && (
									<p
										id={errorId}
										role="alert"
										data-testid={`date-error-${index}`}
										className="text-sm text-red-700"
									>
										{t(errorKey)}
									</p>
								)}
							</li>
						);
					})}
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

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={!isComplete}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
