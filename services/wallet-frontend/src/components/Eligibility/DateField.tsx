import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	dateFormatForLocale,
	formatIsoForInput,
	maskDateInput,
	parseLocalizedDate,
} from "../../utils/date";

interface DateFieldProps {
	id: string;
	/** ISO, or undefined while the field has no usable date yet. */
	value?: string;
	onChange: (iso: string) => void;
	onClear: () => void;
	/** Rendered under the field once it is left, never while typing. */
	errorKey?: (draftIso: string) => string | undefined;
	ariaLabelledBy?: string;
	describedBy?: string;
	className?: string;
	testId?: string;
	errorTestId?: string;
}

/**
 * A date field in the visitor's own notation.
 *
 * Deliberately not `<input type="date">`: a native date input takes its segment order from
 * the browser's locale rather than the page's, so a German UI shows mm/dd/yyyy to anyone
 * whose browser runs in English, and nothing in the markup can override it. A text field
 * with the locale's own mask is the only way to promise TT.MM.JJJJ and keep it.
 */
export const DateField: React.FC<DateFieldProps> = ({
	id,
	value,
	onChange,
	onClear,
	errorKey,
	ariaLabelledBy,
	describedBy,
	className,
	testId,
	errorTestId,
}) => {
	const { t, i18n } = useTranslation();
	const locale = i18n.language;
	const { placeholder } = useMemo(() => dateFormatForLocale(locale), [locale]);

	const [draft, setDraft] = useState(() =>
		formatIsoForInput(value ?? "", locale),
	);
	const [isFocused, setIsFocused] = useState(false);

	// Re-sync only when the stored answer changes underneath us — going back a question,
	// for instance. Rewriting the draft while it is being typed would fight the visitor.
	const [lastValue, setLastValue] = useState(value);
	if (value !== lastValue) {
		setLastValue(value);
		if (value && value !== parseLocalizedDate(draft, locale)) {
			setDraft(formatIsoForInput(value, locale));
		}
	}

	const iso = parseLocalizedDate(draft, locale);
	// Held until the field is left: a year walks through 0002, 0020, 0202 on the way to
	// 2026, and a message flashing three times is worse than none.
	const error = isFocused ? undefined : errorKey?.(iso);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const masked = maskDateInput(event.target.value, locale);
		setDraft(masked);
		const parsed = parseLocalizedDate(masked, locale);
		if (parsed) {
			onChange(parsed);
		} else {
			onClear();
		}
	};

	return (
		<>
			<input
				id={id}
				type="text"
				inputMode="numeric"
				autoComplete="bday"
				placeholder={placeholder}
				aria-labelledby={ariaLabelledBy}
				aria-describedby={describedBy}
				aria-invalid={error !== undefined}
				data-testid={testId}
				value={draft}
				onChange={handleChange}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				className={`h-12 px-3 rounded-xl border-2 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary ${
					error ? "border-red-400" : "border-brand-border/30"
				} ${className ?? ""}`}
			/>
			{error && (
				<p
					id={describedBy}
					role="alert"
					data-testid={errorTestId}
					className="mt-2 text-sm text-red-700"
				>
					{t(error)}
				</p>
			)}
		</>
	);
};
