export const END_PAGE = 8;

const STEP_TO_PAGE_MAP: Record<string, number> = {
	step_applicant_benefits_awaiting_decision: 1,
	step_applicant_benefits_awaiting_decision_details: 1,
	step_previous_benefits: 2,
	step_previous_benefits_details: 2,
	step_applicant_pension: 3,
	step_applicant_employment: 4,
	step_applicant_employment_details: 4,
	step_applicant_work_capacity: 4,
	step_applicant_work_capacity_reason: 4,
	step_applicant_income_work: 5,
	step_applicant_income_benefits: 5,
	step_applicant_income_other: 5,
	step_applicant_expected_payments: 6,
	step_applicant_expected_payments_details: 6,
	step_applicant_bank_details: 7,
};

export interface WizardSaveResult {
	data?: { wizard_evaluation?: { next_step?: string | null } | null };
}

export const getNextPage = (
	result: WizardSaveResult,
	fallbackPage: number,
): number => {
	const nextStepId = result.data?.wizard_evaluation?.next_step;
	if (!nextStepId) {
		return fallbackPage;
	}
	if (nextStepId === "END") {
		return END_PAGE;
	}
	return STEP_TO_PAGE_MAP[nextStepId] ?? fallbackPage;
};

export const parseAmount = (value: string) => Number(value.replace(",", "."));

export const isInvalidAmount = (value: string) => {
	if (value.trim() === "") {
		return false;
	}
	const amount = parseAmount(value);
	return isNaN(amount) || amount < 0;
};

export const toggleOption = (list: string[], value: string): string[] => {
	if (value === "none") {
		return ["none"];
	}
	return list.includes(value)
		? list.filter((item) => item !== value)
		: [...list.filter((item) => item !== "none"), value];
};

export const isWithoutEmployment = (employmentType: string) =>
	employmentType === "Arbeitslos" || employmentType === "Nichts davon";

const EMPLOYMENT_SOURCES: Record<string, string> = {
	Angestellt: "employment_employed",
	Selbststaendig: "employment_self",
	Ausbildung: "employment_student",
	Arbeitslos: "employment_unemployed",
	"Nichts davon": "employment_none",
};

const OTHER_INCOME_SOURCES: Record<string, string> = {
	Krankengeld: "other_sick",
	Unterhalt: "other_alimony",
	Sonstige: "other_rent",
};

export const withPensionSources = (
	sources: string[],
	pensionTypes: string[],
): string[] => {
	const updated = sources.filter(
		(s) => !s.startsWith("pension") && s !== "none_pension",
	);
	if (pensionTypes.includes("none")) {
		updated.push("none_pension");
	} else if (pensionTypes.length > 0) {
		updated.push("pension");
		pensionTypes.forEach((type) => {
			updated.push(`pension_${type.toLowerCase()}`);
		});
	}
	return updated;
};

export const withEmploymentSource = (
	sources: string[],
	employmentType: string,
): string[] => {
	const updated = sources.filter((s) => !s.startsWith("employment_"));
	const source = EMPLOYMENT_SOURCES[employmentType];
	if (source) {
		updated.push(source);
	}
	return updated;
};

export const withOtherIncomeSources = (
	sources: string[],
	otherIncomeTypes: string[],
): string[] => {
	const updated = sources.filter(
		(s) =>
			s !== "other_benefits" &&
			s !== "other" &&
			s !== "none_other" &&
			!s.startsWith("other_"),
	);
	if (otherIncomeTypes.includes("none")) {
		updated.push("none_other");
	} else if (otherIncomeTypes.length > 0) {
		if (
			otherIncomeTypes.includes("Krankengeld") ||
			otherIncomeTypes.includes("Unterhalt")
		) {
			updated.push("other_benefits");
		}
		if (otherIncomeTypes.includes("Sonstige")) {
			updated.push("other");
		}
		otherIncomeTypes.forEach((type) => {
			const source = OTHER_INCOME_SOURCES[type];
			if (source) {
				updated.push(source);
			}
		});
	}
	return updated;
};

interface IncomeAnswers {
	pensionTypes: string[];
	pensionAmount: string;
	employmentType: string;
	employmentAmount: string;
	otherIncomeTypes: string[];
	otherIncomeAmount: string;
}

export const calculateTotalIncome = ({
	pensionTypes,
	pensionAmount,
	employmentType,
	employmentAmount,
	otherIncomeTypes,
	otherIncomeAmount,
}: IncomeAnswers): number | null => {
	const isAnswered =
		pensionTypes.length > 0 ||
		employmentType !== "" ||
		otherIncomeTypes.length > 0;
	if (!isAnswered) {
		return null;
	}

	const amountOrZero = (value: string, isNone: boolean) =>
		value === "" || isNone ? 0 : parseAmount(value);

	return (
		amountOrZero(pensionAmount, pensionTypes.includes("none")) +
		amountOrZero(employmentAmount, isWithoutEmployment(employmentType)) +
		amountOrZero(otherIncomeAmount, otherIncomeTypes.includes("none"))
	);
};
