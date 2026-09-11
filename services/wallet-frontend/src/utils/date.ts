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

/**
 * Today as an ISO date (YYYY-MM-DD) in the visitor's own timezone.
 *
 * Built from the local calendar components rather than `toISOString()`, which would
 * hand back the UTC day — the wrong one for a few hours every evening in Berlin, and
 * enough to reject a birthday entered today. Locale-independent on purpose: a
 * `toLocaleDateString` formatter depends on the runtime's ICU data.
 */
export const todayIsoDate = (): string => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

/**
 * The separator and field order a locale writes dates in. German uses DD.MM.YYYY, English
 * MM/DD/YYYY — which is why a native `<input type="date">` is unusable here: the browser,
 * not the page, decides its segment order, so a German UI in an English browser asks for
 * the month first.
 */
export const dateFormatForLocale = (
	locale: string = DEFAULT_LOCALE,
): { separator: string; monthFirst: boolean; placeholder: string } =>
	locale.toLowerCase().startsWith("en")
		? { separator: "/", monthFirst: true, placeholder: "MM/DD/YYYY" }
		: { separator: ".", monthFirst: false, placeholder: "TT.MM.JJJJ" };

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number): boolean =>
	(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Plain arithmetic rather than `new Date(y, m, d)`, which maps years 0-99 onto 1900-1999 and
 * would silently turn a mistyped year 0001 into 1901 — hiding the very out-of-range date the
 * questionnaire wants to complain about.
 */
const isRealCalendarDate = (
	year: number,
	month: number,
	day: number,
): boolean => {
	if (month < 1 || month > 12 || day < 1) {
		return false;
	}
	const limit =
		month === 2 && isLeapYear(year) ? 29 : DAYS_PER_MONTH[month - 1];
	return day <= limit;
};

/** A localized date string to ISO, or "" when it is not a real date. */
export const parseLocalizedDate = (
	value: string,
	locale: string = DEFAULT_LOCALE,
): string => {
	const digits = value.replace(/\D/g, "");
	if (digits.length !== 8) {
		return "";
	}
	const { monthFirst } = dateFormatForLocale(locale);
	const day = monthFirst ? digits.slice(2, 4) : digits.slice(0, 2);
	const month = monthFirst ? digits.slice(0, 2) : digits.slice(2, 4);
	const year = digits.slice(4);
	return isRealCalendarDate(Number(year), Number(month), Number(day))
		? `${year}-${month}-${day}`
		: "";
};

/** ISO to what the visitor types, so a stored answer can be shown back to them. */
export const formatIsoForInput = (
	iso: string,
	locale: string = DEFAULT_LOCALE,
): string => {
	if (!iso) {
		return "";
	}
	const [year, month, day] = iso.split("-");
	const { separator, monthFirst } = dateFormatForLocale(locale);
	return monthFirst
		? `${month}${separator}${day}${separator}${year}`
		: `${day}${separator}${month}${separator}${year}`;
};

/** Inserts the locale's separators as digits arrive, so the field shapes itself. */
export const maskDateInput = (
	value: string,
	locale: string = DEFAULT_LOCALE,
): string => {
	const digits = value.replace(/\D/g, "").slice(0, 8);
	const { separator } = dateFormatForLocale(locale);
	const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
	return parts.filter((part) => part.length > 0).join(separator);
};
