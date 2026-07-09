import type { TFunction } from "i18next";

/**
 * Safely retrieves an array of strings from i18next translations.
 * Future-proofs against malformed translation files or missing keys.
 */
export const getTranslationArray = (
	t: TFunction,
	key: string,
	fallback: string[] = [],
): string[] => {
	const result = t(key, { returnObjects: true });

	if (
		Array.isArray(result) &&
		result.every((item) => typeof item === "string")
	) {
		return result as string[];
	}

	console.warn(
		`Translation key "${key}" did not return a valid string array. Falling back.`,
	);
	return fallback;
};
