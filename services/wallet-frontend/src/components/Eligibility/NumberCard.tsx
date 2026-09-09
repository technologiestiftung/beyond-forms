import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info } from "lucide-react";

interface NumberCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	unitLabel: string;
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
	value,
	onChange,
	onClear,
	onNext,
}) => {
	const { t } = useTranslation();
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

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
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
							aria-describedby={tip ? `${id}-tip` : undefined}
							data-testid="number-input"
							value={draft}
							onChange={handleChange}
							className="h-12 flex-1 px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary"
						/>
						<span className="text-base text-brand-grey shrink-0">
							{unitLabel}
						</span>
					</div>
				</div>
			</fieldset>

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
