import { z } from "zod";

export const Binary = {
	YES: "YES",
	NO: "NO",
} as const;

export type Binary = (typeof Binary)[keyof typeof Binary];

export const BinarySchema = z.enum([Binary.YES, Binary.NO]);

export const NationalityStatus = {
	GERMAN: "GERMAN",
	EU_5_PLUS: "EU_5_PLUS",
	RESIDENCE_PERMIT: "RESIDENCE_PERMIT",
	NONE: "NONE",
} as const;

export type NationalityStatus =
	(typeof NationalityStatus)[keyof typeof NationalityStatus];

export const NationalityStatusSchema = z.enum([
	NationalityStatus.GERMAN,
	NationalityStatus.EU_5_PLUS,
	NationalityStatus.RESIDENCE_PERMIT,
	NationalityStatus.NONE,
]);

export const PensionStatus = {
	OLD_AGE: "OLD_AGE",
	REDUCED_EARNING_CAPACITY: "REDUCED_EARNING_CAPACITY",
	NONE: "NONE",
} as const;

export type PensionStatus = (typeof PensionStatus)[keyof typeof PensionStatus];

export const PensionStatusSchema = z.enum([
	PensionStatus.OLD_AGE,
	PensionStatus.REDUCED_EARNING_CAPACITY,
	PensionStatus.NONE,
]);

export const IncomeStatus = {
	NOT_SUFFICIENT: "NOT_SUFFICIENT",
	SOON_INSUFFICIENT: "SOON_INSUFFICIENT",
	SUFFICIENT: "SUFFICIENT",
} as const;

export type IncomeStatus = (typeof IncomeStatus)[keyof typeof IncomeStatus];

export const IncomeStatusSchema = z.enum([
	IncomeStatus.NOT_SUFFICIENT,
	IncomeStatus.SOON_INSUFFICIENT,
	IncomeStatus.SUFFICIENT,
]);

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayIsoDate(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export const EligibilityCheckSchema = z.object({
	nationality: NationalityStatusSchema.describe(
		"Nationality and residence status",
	),
	livesInGermany: BinarySchema.describe("Do you live in Germany?"),
	dateOfBirth: z
		.string()
		.regex(ISO_DATE_PATTERN, "Invalid date format")
		.refine((val) => {
			const [year, month, day] = val.split("-").map(Number);
			const date = new Date(year, month - 1, day);
			return (
				date.getFullYear() === year &&
				date.getMonth() === month - 1 &&
				date.getDate() === day
			);
		}, "Invalid date")
		.refine(
			(val) => val >= "1900-01-01",
			"Date must be on or after 1 January 1900",
		)
		.refine(
			(val) => val <= todayIsoDate(),
			"Date of birth cannot be in the future",
		)
		.describe("Date of birth"),
	pension: PensionStatusSchema.describe("Pension status"),
	income: IncomeStatusSchema.describe("Income assessment"),
	hasAssetsAboveThreshold: BinarySchema.describe(
		"Do you have assets above €10,000?",
	),
});

export type EligibilityCheck = z.infer<typeof EligibilityCheckSchema>;

export const ResultProfile = {
	ELIGIBLE: "ELIGIBLE",
	NOT_ELIGIBLE: "NOT_ELIGIBLE",
	SOZIALAMT: "SOZIALAMT",
} as const;

export type ResultProfile = (typeof ResultProfile)[keyof typeof ResultProfile];
