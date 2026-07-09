import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info } from "lucide-react";

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
	const { t } = useTranslation();
	const labelRef = useRef<HTMLLabelElement>(null);
	const [draft, setDraft] = useState(value ?? "");
	const [prevValue, setPrevValue] = useState(value);

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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (value) {
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

					<h1 className="text-xl font-bold text-brand-black leading-snug focus:outline-none">
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
						htmlFor={`${id}-dob`}
						tabIndex={-1}
						id={`${id}-legend`}
						className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block"
					>
						{question}
					</label>
					<input
						id={`${id}-dob`}
						type="date"
						aria-labelledby={`${id}-legend`}
						aria-describedby={tip ? `${id}-tip` : undefined}
						data-testid="dob-date-input"
						value={draft}
						onChange={handleDateChange}
						min="1900-01-01"
						max={maxDate}
						className="h-12 w-full px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary"
					/>
				</div>
			</fieldset>

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={!value}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
