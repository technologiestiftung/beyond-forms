import { z } from "zod";

export const WorkCapacity = {
	FULL: "FULL",
	PERMANENTLY_REDUCED: "PERMANENTLY_REDUCED",
	TEMPORARILY_REDUCED: "TEMPORARILY_REDUCED",
} as const;
export type WorkCapacity = (typeof WorkCapacity)[keyof typeof WorkCapacity];
export const WorkCapacitySchema = z.enum([
	WorkCapacity.FULL,
	WorkCapacity.PERMANENTLY_REDUCED,
	WorkCapacity.TEMPORARILY_REDUCED,
]);

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

/** Guards against 2026-02-30 and friends, which the regex alone lets through. */
const isRealCalendarDate = (value: string): boolean => {
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	);
};

const todayIsoDate = (): string => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

/**
 * Used for the applicant and for every child. Reading the clock is acceptable here because
 * this is input validation, not decision logic — the engine always takes `today` as an
 * argument so its outcomes stay testable.
 */
export const BirthDateSchema = z
	.string()
	.regex(ISO_DATE_PATTERN, "Invalid date format")
	.refine(isRealCalendarDate, "Invalid date")
	.refine((v) => v >= "1900-01-01", "Date must be on or after 1 January 1900")
	.refine((v) => v <= todayIsoDate(), "Date of birth cannot be in the future");

export const ChildEntrySchema = z.object({ dateOfBirth: BirthDateSchema });
export type ChildEntry = z.infer<typeof ChildEntrySchema>;

/**
 * Flat on purpose. Every question writes exactly one of these fields and every field has
 * exactly one question, so the store can validate per field via
 * `BenefitCheckAnswersSchema.shape[field]` and `Partial<>` expresses "answered so far".
 *
 * A nested shape does not survive a step-by-step questionnaire: with employment as an
 * object, `{ isEmployed: true }` fails validation because the gross income is mandatory
 * once the object exists.
 */
export const BenefitCheckAnswersSchema = z.object({
	householdComposition: HouseholdCompositionSchema,
	children: z.array(ChildEntrySchema),
	dateOfBirth: BirthDateSchema,
	livesInGermany: z.boolean(),
	workCapacity: WorkCapacitySchema,
	isEmployed: z.boolean(),
	monthlyGrossIncome: z.number().min(0),
	monthlyNetHouseholdIncome: z.number().min(0),
	monthlyWarmRent: z.number().min(0),
	assetsBand: AssetsBandSchema,
	receivesBenefitsAlready: z.boolean(),
	citizenship: CitizenshipSchema,
	hasSecureResidenceStatus: z.boolean(),
	childReceivesFullSupport: z.boolean(),
	monthsWithoutChildSupport: z.number().int().min(0),
});

export type BenefitCheckAnswers = z.infer<typeof BenefitCheckAnswersSchema>;
export type PartialBenefitCheckAnswers = Partial<BenefitCheckAnswers>;

export const BenefitId = {
	/** Grundsicherungsgeld, SGB II (bis 30.6.2026: Bürgergeld) */
	SGB_II_BASIC_INCOME: "SGB_II_BASIC_INCOME",
	/** Grundsicherung im Alter und bei Erwerbsminderung, SGB XII Kap. 4 */
	SGB_XII_OLD_AGE_REDUCED_CAPACITY: "SGB_XII_OLD_AGE_REDUCED_CAPACITY",
	/** Hilfe zum Lebensunterhalt, SGB XII Kap. 3 */
	SGB_XII_SUBSISTENCE_AID: "SGB_XII_SUBSISTENCE_AID",
	/** Wohngeld, WoGG */
	HOUSING_BENEFIT: "HOUSING_BENEFIT",
	/** Kinderzuschlag, §6a BKGG */
	CHILD_SUPPLEMENT: "CHILD_SUPPLEMENT",
	/** Unterhaltsvorschuss, UVG */
	ADVANCE_MAINTENANCE: "ADVANCE_MAINTENANCE",
	/**
	 * Bildungs- und Teilhabepaket, §28 SGB II / §34 SGB XII. Unlike the six above it has
	 * no test of its own: it follows from one of the base benefits, so `evaluate` derives
	 * it from their verdicts. Listed last so the stable sort keeps it below the benefit
	 * that carries it.
	 */
	EDUCATION_PARTICIPATION_PACKAGE: "EDUCATION_PARTICIPATION_PACKAGE",
} as const;
export type BenefitId = (typeof BenefitId)[keyof typeof BenefitId];

export const BenefitStatus = {
	LIKELY_YES: "LIKELY_YES",
	CHECK_ADVISED: "CHECK_ADVISED",
	LIKELY_NO: "LIKELY_NO",
	NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type BenefitStatus = (typeof BenefitStatus)[keyof typeof BenefitStatus];

export const ReasonCode = {
	INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
	RETIREMENT_AGE_REACHED: "RETIREMENT_AGE_REACHED",
	RETIREMENT_AGE_NOT_REACHED: "RETIREMENT_AGE_NOT_REACHED",
	WORK_CAPACITY_NOT_FULL: "WORK_CAPACITY_NOT_FULL",
	NOT_IN_CAPACITY_GAP: "NOT_IN_CAPACITY_GAP",
	RESIDENCE_STATUS_UNCLEAR: "RESIDENCE_STATUS_UNCLEAR",
	ALREADY_RECEIVING_BENEFITS: "ALREADY_RECEIVING_BENEFITS",
	BENEFITS_TAKE_PRECEDENCE: "BENEFITS_TAKE_PRECEDENCE",
	INCOME_BELOW_NEEDS: "INCOME_BELOW_NEEDS",
	INCOME_COVERS_NEEDS: "INCOME_COVERS_NEEDS",
	INCOME_BELOW_SUBSISTENCE: "INCOME_BELOW_SUBSISTENCE",
	ASSETS_BELOW_ALLOWANCE: "ASSETS_BELOW_ALLOWANCE",
	ASSETS_SPAN_ALLOWANCE: "ASSETS_SPAN_ALLOWANCE",
	ASSETS_ABOVE_ALLOWANCE: "ASSETS_ABOVE_ALLOWANCE",
	RENT_BURDEN_HIGH: "RENT_BURDEN_HIGH",
	RENT_BURDEN_NORMAL: "RENT_BURDEN_NORMAL",
	NO_ELIGIBLE_CHILDREN: "NO_ELIGIBLE_CHILDREN",
	KIZ_MIN_INCOME_MET: "KIZ_MIN_INCOME_MET",
	KIZ_MIN_INCOME_NOT_MET: "KIZ_MIN_INCOME_NOT_MET",
	NOT_SINGLE_PARENT: "NOT_SINGLE_PARENT",
	NO_MINOR_CHILDREN: "NO_MINOR_CHILDREN",
	CHILD_RECEIVES_FULL_SUPPORT: "CHILD_RECEIVES_FULL_SUPPORT",
	CHILD_SUPPORT_INCOMPLETE: "CHILD_SUPPORT_INCOMPLETE",
	EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT:
		"EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT",
	EDUCATION_PACKAGE_NEEDS_BASE_BENEFIT: "EDUCATION_PACKAGE_NEEDS_BASE_BENEFIT",
	CAPACITY_GAP_PRECONDITION_MET: "CAPACITY_GAP_PRECONDITION_MET",
} as const;
export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode];

export const HintCode = {
	ASYLUM_BENEFITS_REFERRAL: "ASYLUM_BENEFITS_REFERRAL",
} as const;
export type HintCode = (typeof HintCode)[keyof typeof HintCode];

export interface BenefitAssessment {
	benefit: BenefitId;
	status: BenefitStatus;
	reasons: ReasonCode[];
}

export interface BenefitCheckResult {
	/** Always all seven, in the order of `BenefitId`. */
	assessments: BenefitAssessment[];
	hints: HintCode[];
}
