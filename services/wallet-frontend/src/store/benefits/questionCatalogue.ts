import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type {
	BenefitCheckAnswers,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import { WORK_CAPACITY_SKIP_GROSS_INCOME } from "../../config/benefitRules.config";
import {
	compositionImpliesChildren,
	hasReachedRetirementAge,
	isCouple,
} from "./derive";

export type QuestionInput =
	| "choice"
	| "boolean"
	| "date"
	| "number"
	| "children";

export interface BenefitQuestion {
	/** Route segment under /eligibility-check/. */
	id: string;
	field: keyof BenefitCheckAnswers;
	input: QuestionInput;
	/** Only for "choice". Boolean questions use BINARY_OPTIONS. */
	options?: readonly string[];
	/** Only for "number". Drives the suffix the input shows. */
	unit?: "EUR";
	/** Invariant enforced by questionCatalogue.test.ts: reads only earlier fields. */
	skipIf?: (answers: PartialBenefitCheckAnswers, today: string) => boolean;
}

/** Boolean questions render through QuestionCard, which works on option strings. */
export const BINARY_OPTIONS = ["YES", "NO"] as const;

const childless = (answers: PartialBenefitCheckAnswers): boolean =>
	answers.householdComposition !== undefined &&
	!compositionImpliesChildren(answers.householdComposition);

export const QUESTION_CATALOGUE: readonly BenefitQuestion[] = [
	{
		id: "household",
		field: "householdComposition",
		input: "choice",
		options: [
			HouseholdComposition.SINGLE,
			HouseholdComposition.SINGLE_PARENT,
			HouseholdComposition.COUPLE_NO_CHILDREN,
			HouseholdComposition.COUPLE_WITH_CHILDREN,
		],
	},
	{
		id: "children",
		field: "children",
		input: "children",
		skipIf: childless,
	},
	{
		id: "birthdate",
		field: "dateOfBirth",
		input: "date",
	},
	{
		id: "germany",
		field: "livesInGermany",
		input: "boolean",
	},
	{
		id: "employment",
		field: "isEmployed",
		input: "boolean",
	},
	{
		// Asked of everyone: not working is not the same as having no gross income, and the
		// Kinderzuschlag rule needs the figure either way. 0 is a valid answer.
		//
		// Strictly the applicant's own. The work-capacity skip below reads it as a statement
		// about this person's working hours, which a household figure could not support.
		id: "gross-income",
		field: "monthlyGrossIncome",
		input: "number",
		unit: "EUR",
	},
	{
		// Kinderzuschlag's minimum applies to a couple's combined gross, so the partner's
		// share has to be asked for separately once the applicant's own is known.
		id: "partner-gross-income",
		field: "partnerMonthlyGrossIncome",
		input: "number",
		unit: "EUR",
		skipIf: (answers) =>
			answers.householdComposition !== undefined &&
			!isCouple(answers.householdComposition),
	},
	{
		id: "work-capacity",
		field: "workCapacity",
		input: "choice",
		options: [
			WorkCapacity.FULL,
			WorkCapacity.TEMPORARILY_REDUCED,
			WorkCapacity.PERMANENTLY_REDUCED,
		],
		/**
		 * Skipped past the retirement age, where the SGB XII rule keys off the age instead,
		 * and above the income threshold, where `useBenefitCheckNavigation` records FULL.
		 *
		 * The threshold exists for the case BELOW it: Werkstatt pay sits far under it, and
		 * those workers are exactly who the SGB XII assessment must not miss. `gross-income`
		 * is the applicant's own, so a partner's earnings cannot trigger this skip.
		 */
		skipIf: (answers, today) =>
			(answers.dateOfBirth !== undefined &&
				hasReachedRetirementAge(answers.dateOfBirth, today)) ||
			(answers.monthlyGrossIncome !== undefined &&
				answers.monthlyGrossIncome > WORK_CAPACITY_SKIP_GROSS_INCOME),
	},
	{
		id: "net-income",
		field: "monthlyNetHouseholdIncome",
		input: "number",
		unit: "EUR",
	},
	{
		id: "warm-rent",
		field: "monthlyWarmRent",
		input: "number",
		unit: "EUR",
	},
	{
		id: "assets",
		field: "assetsBand",
		input: "choice",
		options: [
			AssetsBand.UNDER_5000,
			AssetsBand.FROM_5000_TO_15000,
			AssetsBand.FROM_15000_TO_25000,
			AssetsBand.OVER_25000,
		],
	},
	{
		id: "benefits",
		field: "receivesBenefitsAlready",
		input: "boolean",
	},
	{
		// Always asked: every rule needs the residence requirement, so anyone not asked
		// would get INSUFFICIENT_DATA on all four and no result at all.
		id: "citizenship",
		field: "citizenship",
		input: "choice",
		options: [Citizenship.DE_EU, Citizenship.NON_EU],
	},
	{
		id: "residence-status",
		field: "hasSecureResidenceStatus",
		input: "boolean",
		skipIf: (answers) => answers.citizenship === Citizenship.DE_EU,
	},
];
