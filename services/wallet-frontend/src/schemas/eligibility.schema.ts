import { z } from "zod";

export const Binary = {
	YES: "YES",
	NO: "NO",
} as const;

export type Binary = (typeof Binary)[keyof typeof Binary];

export const BinarySchema = z.enum([Binary.YES, Binary.NO]);

export const HouseholdComposition = {
	SINGLE: "SINGLE",
	SINGLE_PARENT: "SINGLE_PARENT",
	COUPLE_NO_CHILDREN: "COUPLE_NO_CHILDREN",
	COUPLE_WITH_CHILDREN: "COUPLE_WITH_CHILDREN",
} as const;

export type HouseholdComposition =
	(typeof HouseholdComposition)[keyof typeof HouseholdComposition];

export const HouseholdCompositionSchema = z.enum([
	HouseholdComposition.SINGLE,
	HouseholdComposition.SINGLE_PARENT,
	HouseholdComposition.COUPLE_NO_CHILDREN,
	HouseholdComposition.COUPLE_WITH_CHILDREN,
]);

export const WorkCapacity = {
	FULL: "FULL",
	TEMPORARILY_REDUCED: "TEMPORARILY_REDUCED",
	PERMANENTLY_REDUCED: "PERMANENTLY_REDUCED",
} as const;

export type WorkCapacity = (typeof WorkCapacity)[keyof typeof WorkCapacity];

export const WorkCapacitySchema = z.enum([
	WorkCapacity.FULL,
	WorkCapacity.TEMPORARILY_REDUCED,
	WorkCapacity.PERMANENTLY_REDUCED,
]);

export const AssetsBand = {
	UNDER_5000: "UNDER_5000",
	FROM_5000_TO_15000: "FROM_5000_TO_15000",
	FROM_15000_TO_25000: "FROM_15000_TO_25000",
	OVER_25000: "OVER_25000",
} as const;

export type AssetsBand = (typeof AssetsBand)[keyof typeof AssetsBand];

export const AssetsBandSchema = z.enum([
	AssetsBand.UNDER_5000,
	AssetsBand.FROM_5000_TO_15000,
	AssetsBand.FROM_15000_TO_25000,
	AssetsBand.OVER_25000,
]);

export const Citizenship = {
	DE_EU: "DE_EU",
	NON_EU: "NON_EU",
} as const;

export type Citizenship = (typeof Citizenship)[keyof typeof Citizenship];

export const CitizenshipSchema = z.enum([
	Citizenship.DE_EU,
	Citizenship.NON_EU,
]);

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD in local time, matching what a date input shows. */
export function localDateToday(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const BirthDateSchema = z
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
		(val) => val <= localDateToday(),
		"Date of birth cannot be in the future",
	);

const EuroAmountSchema = z.number().int().min(0);

export const EligibilityCheckSchema = z.object({
	householdComposition: HouseholdCompositionSchema.describe(
		"Who lives in the household",
	),
	children: z
		.array(z.object({ dateOfBirth: BirthDateSchema }))
		.min(1)
		.describe("Birth dates of the children in the household"),
	dateOfBirth: BirthDateSchema.describe("Date of birth"),
	livesInGermany: BinarySchema.describe("Do you live in Germany?"),
	isEmployed: BinarySchema.describe("Do you currently work?"),
	monthlyGrossIncome: EuroAmountSchema.describe(
		"Monthly gross earnings of the household",
	),
	workCapacity: WorkCapacitySchema.describe(
		"Can you work at least three hours a day?",
	),
	monthlyNetHouseholdIncome: EuroAmountSchema.describe(
		"Monthly net income of the household",
	),
	monthlyWarmRent: EuroAmountSchema.describe("Monthly warm rent"),
	assetsBand: AssetsBandSchema.describe("Savings"),
	receivesBenefits: BinarySchema.describe("Already receiving a benefit?"),
	citizenship: CitizenshipSchema.describe("German or EU citizenship?"),
	hasSecureResidenceStatus: BinarySchema.describe("Secure residence permit?"),
});

export type EligibilityCheck = z.infer<typeof EligibilityCheckSchema>;

export const ResultProfile = {
	ELIGIBLE: "ELIGIBLE",
	NOT_ELIGIBLE: "NOT_ELIGIBLE",
} as const;

export type ResultProfile = (typeof ResultProfile)[keyof typeof ResultProfile];
