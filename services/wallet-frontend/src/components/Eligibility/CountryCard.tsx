import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ISO_COUNTRY_CODES } from "../../constants/isoCountries";
import { QuestionLayout } from "./QuestionLayout";
import { questionTipId } from "./questionTipId";

interface CountryCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	/** ISO 3166-1 alpha-2 code */
	value?: string;
	onChange: (value: string) => void;
	onClear: () => void;
	onNext: () => void;
}

/** Most applicants are German, so Germany is listed first, then all countries by name */
const FIRST = "DE";

export const CountryCard: React.FC<CountryCardProps> = ({
	id,
	question,
	category,
	tip,
	value,
	onChange,
	onClear,
	onNext,
}) => {
	const { t, i18n } = useTranslation();
	const labelRef = useRef<HTMLLabelElement>(null);
	const tipId = questionTipId(id);

	useEffect(() => {
		labelRef.current?.focus();
	}, [id]);

	const countries = useMemo(() => {
		const names = new Intl.DisplayNames([i18n.language], { type: "region" });
		const collator = new Intl.Collator(i18n.language);
		const named = ISO_COUNTRY_CODES.map((code) => ({
			code,
			name: names.of(code) ?? code,
		}));
		return [
			...named.filter(({ code }) => code === FIRST),
			...named
				.filter(({ code }) => code !== FIRST)
				.sort((a, b) => collator.compare(a.name, b.name)),
		];
	}, [i18n.language]);

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
					htmlFor={`${id}-select`}
					tabIndex={-1}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block lg:mb-4 lg:text-h2"
				>
					{question}
				</label>
				<select
					id={`${id}-select`}
					aria-describedby={tip ? tipId : undefined}
					data-testid="country-select"
					value={value ?? ""}
					onChange={(event) =>
						event.target.value ? onChange(event.target.value) : onClear()
					}
					className="h-12 w-full px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white transition-colors hover:border-primary-blue-300 focus:outline-none focus:border-brand-primary lg:h-14 lg:max-w-xl lg:rounded-2xl lg:border-brand-border-subtle lg:bg-brand-bg lg:px-5 lg:text-body-lg lg:focus:border-primary-blue-500 lg:focus:bg-white"
				>
					<option value="">{t("country_placeholder")}</option>
					{countries.map(({ code, name }) => (
						<option key={code} value={code}>
							{name}
						</option>
					))}
				</select>
			</div>
		</QuestionLayout>
	);
};
