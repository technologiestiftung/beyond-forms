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
	const { t } = useTranslation();
	const labelRef = useRef<HTMLLabelElement>(null);
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

	const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
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
						htmlFor={`${id}-input`}
						tabIndex={-1}
						className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block"
					>
						{question}
					</label>
					<div className="relative">
						<input
							id={`${id}-input`}
							type="text"
							inputMode="numeric"
							autoComplete="off"
							aria-describedby={tip ? `${id}-tip` : undefined}
							data-testid="number-input"
							value={draft}
							onChange={handleChange}
							className="h-12 w-full pl-3 pr-10 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary"
						/>
						<span
							className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-grey"
							aria-hidden="true"
						>
							€
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
