import { DEFAULT_LOCALE } from "../constants/locale";

/**
 * Formats any valid ISO date string into a localized format.
 * Defaults to German standard format (DD.MM.YYYY).
 * Enforces consistent rendering across server and client timezones (UTC).
 */
export const formatDateString = (
	value: string,
	locale: string = DEFAULT_LOCALE,
): string => {
	if (!value) {
		return "";
	}

	const timestamp = Date.parse(value);
	if (isNaN(timestamp)) {
		return value; // Return as-is if string is not a parseable date
	}

	// Prevent silent month overflow roll-over (e.g. "2026-02-30" parsing and rolling over to "02.03.2026")
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (match) {
		const [_, yearStr, monthStr, dayStr] = match;
		const year = Number(yearStr);
		const month = Number(monthStr);
		const day = Number(dayStr);
		const date = new Date(timestamp);
		if (
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() + 1 !== month ||
			date.getUTCDate() !== day
		) {
			return value; // Return original value as-is if calendar components mismatch (invalid date)
		}
	}

	return new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "UTC", // Enforce consistent rendering across server and client timezones
	}).format(new Date(timestamp));
};

/**
 * Converts a German standard date string (DD.MM.YYYY) back into database-safe ISO format (YYYY-MM-DD).
 */
export const convertGermanToIsoDate = (value: string): string => {
	if (!value) {
		return "";
	}

	const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
	if (!match) {
		return value;
	}

	const [_, dayStr, monthStr, yearStr] = match;
	const day = Number(dayStr);
	const month = Number(monthStr);
	const year = Number(yearStr);

	// Calendar date validation
	const date = new Date(year, month - 1, day);
	if (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	) {
		return `${yearStr}-${monthStr}-${dayStr}`;
	}

	return value;
};
