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
import { compositionImpliesChildren, hasReachedRetirementAge } from "./derive";

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
	unit?: "EUR" | "MONTHS";
	/**
	 * May only read fields collected EARLIER in this array, and must return false while
	 * the field it reads is undefined — an unanswered question must never cause a skip.
	 */
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
		id: "gross-income",
		field: "monthlyGrossIncome",
		input: "number",
		unit: "EUR",
		skipIf: (answers) => answers.isEmployed === false,
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
		 * Two reasons to skip.
		 *
		 * Past the retirement age the answer no longer routes anything — the SGB XII
		 * rule keys off the age instead.
		 *
		 * Above the income threshold, working under three hours a day would be unusual,
		 * so the answer is taken as FULL. Below it the question stays: Werkstatt pay
		 * sits far under the threshold, and those workers are precisely the people the
		 * SGB XII assessment must not miss.
		 *
		 * `useBenefitCheckNavigation` records `workCapacity: FULL` for the income skip.
		 * Three of the six rules read the field, so leaving it undefined would strand
		 * them all on INSUFFICIENT_DATA.
		 */
		skipIf: (answers, today) =>
			(answers.dateOfBirth !== undefined &&
				hasReachedRetirementAge(answers.dateOfBirth, today)) ||
			(answers.isEmployed === true &&
				answers.monthlyGrossIncome !== undefined &&
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
		/**
		 * Always asked. The domain spec §4 skips it unless other answers suggest a claim,
		 * but every one of the six rules needs the residence requirement, so skipping it
		 * puts all six on CHECK_ADVISED/INSUFFICIENT_DATA — anyone not asked gets no
		 * result at all.
		 */
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
	{
		id: "child-support",
		field: "childReceivesFullSupport",
		input: "boolean",
		skipIf: childless,
	},
	{
		id: "support-duration",
		field: "monthsWithoutChildSupport",
		input: "number",
		unit: "MONTHS",
		/**
		 * Two reasons to skip, and both are needed.
		 *
		 * `childless` covers a household that never sees the support question at all —
		 * without it, a single person would be asked how long maintenance has been
		 * missing.
		 *
		 * The support flag is compared with `=== true` rather than `!== false`, because
		 * the latter is also true while the field is undefined and would skip the
		 * question before it has been asked, leaving the progress denominator short.
		 */
		skipIf: (answers) =>
			childless(answers) || answers.childReceivesFullSupport === true,
	},
];
