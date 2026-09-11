import React, { useEffect, useRef, useState } from "react";
import { QuestionShell } from "./QuestionShell";
import type { QuestionHeader } from "./QuestionShell";

interface NumberCardProps extends QuestionHeader {
	unitLabel: string;
	/** Optional hint under the field, for "an approximate figure is enough". */
	hint?: string;
	value?: number;
	onChange: (value: number) => void;
	onClear: () => void;
	onNext: () => void;
}

/** Digits plus a single separator, which German speakers will type as a comma. */
const ALLOWED = /^[0-9]*[.,]?[0-9]*$/;

export const NumberCard: React.FC<NumberCardProps> = ({
	id,
	question,
	category,
	tip,
	unitLabel,
	hint,
	value,
	onChange,
	onClear,
	onNext,
}) => {
	const labelRef = useRef<HTMLLabelElement>(null);
	const [draft, setDraft] = useState(value === undefined ? "" : String(value));

	useEffect(() => {
		labelRef.current?.focus();
	}, [id]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const raw = event.target.value;
		// Reject the keystroke outright rather than silently dropping characters, so what
		// is on screen is always what was typed.
		if (!ALLOWED.test(raw)) {
			return;
		}
		setDraft(raw);

		if (raw === "" || raw === "." || raw === ",") {
			onClear();
			return;
		}
		const parsed = Number(raw.replace(",", "."));
		if (!Number.isNaN(parsed)) {
			onChange(parsed);
		}
	};

	const describedBy =
		[tip ? `${id}-tip` : null, hint ? `${id}-hint` : null]
			.filter(Boolean)
			.join(" ") || undefined;

	return (
		<QuestionShell
			id={id}
			question={question}
			category={category}
			tip={tip}
			canAdvance={value !== undefined}
			onNext={onNext}
		>
			<div className="w-full">
				<label
					ref={labelRef}
					htmlFor={`${id}-number`}
					tabIndex={-1}
					id={`${id}-legend`}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block"
				>
					{question}
				</label>
				<div className="flex items-center gap-3">
					<input
						id={`${id}-number`}
						// Not type="number": that shows spinner arrows on mobile and lets a
						// stray scroll change the value.
						type="text"
						inputMode="decimal"
						autoComplete="off"
						aria-labelledby={`${id}-legend`}
						aria-describedby={describedBy}
						data-testid="number-input"
						value={draft}
						onChange={handleChange}
						className="h-12 flex-1 px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary"
					/>
					<span className="text-base text-brand-grey shrink-0">
						{unitLabel}
					</span>
				</div>
				{hint && (
					<p
						id={`${id}-hint`}
						data-testid="number-hint"
						className="mt-2 text-sm text-brand-grey"
					>
						{hint}
					</p>
				)}
			</div>
		</QuestionShell>
	);
};
