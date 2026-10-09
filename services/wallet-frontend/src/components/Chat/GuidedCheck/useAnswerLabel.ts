import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../../i18n/i18nKeys";
import type { EligibilityCheck } from "../../../schemas/eligibility.schema";

type Field = keyof EligibilityCheck;

/** Readable labels for a field and its stored answer, in the wording of the eligibility questions. */
export const useAnswerLabel = () => {
	const { t, i18n } = useTranslation();

	const fieldLabel = (field: Field) =>
		t(i18nKeys.eligibility.questionCategory(field));

	const answerLabel = <K extends Field>(
		field: K,
		value: EligibilityCheck[K],
	): string => {
		if (typeof value === "number") {
			return `${value.toLocaleString(i18n.language)} €`;
		}
		if (Array.isArray(value)) {
			return value
				.map((child) =>
					new Date(child.dateOfBirth).toLocaleDateString(i18n.language),
				)
				.join(", ");
		}
		if (field === "dateOfBirth") {
			return new Date(value as string).toLocaleDateString(i18n.language);
		}
		return t(`questions.${field}.options.${String(value)}`, {
			defaultValue: t(String(value).toLowerCase()),
		});
	};

	return { fieldLabel, answerLabel };
};
