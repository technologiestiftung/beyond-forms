import { i18nKeys } from "../../i18n/i18nKeys";

export const EARLIEST_BIRTHDATE = "1900-01-01";

/**
 * Today in the visitor's own timezone. `toISOString` would give UTC, which is the wrong
 * day for a few hours every evening in Berlin and would reject a birthday entered today.
 */
export const todayIso = (): string => new Date().toLocaleDateString("sv-SE");

/**
 * ISO dates compare correctly as plain strings, and "" fails the lower bound, so this one
 * expression separates "ready to use" from empty and out-of-range alike.
 *
 * The range is checked here rather than through `input.validity`, because a date field
 * keeps whatever was typed and validity only describes the DOM node it came from.
 */
export const isUsableDate = (value: string, maxDate: string): boolean =>
	value >= EARLIEST_BIRTHDATE && value <= maxDate;

/**
 * The i18n key naming what is wrong with a date, or undefined when there is nothing to
 * say. An empty field is not an error — it is unanswered, and the disabled next button
 * already carries that.
 */
export const dateRangeErrorKey = (
	value: string,
	maxDate: string,
): string | undefined => {
	if (value === "" || isUsableDate(value, maxDate)) {
		return undefined;
	}
	return value < EARLIEST_BIRTHDATE
		? i18nKeys.eligibility.dateTooEarly
		: i18nKeys.eligibility.dateInFuture;
};
