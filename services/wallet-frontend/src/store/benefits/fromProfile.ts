import {
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import type { Profile } from "../../schemas/profile.schema";

const WORK_CAPACITY_BY_ABILITY: Record<string, WorkCapacity> = {
	"Fully able": WorkCapacity.FULL,
	"Temporarily disabled": WorkCapacity.TEMPORARILY_REDUCED,
	"Permanently disabled": WorkCapacity.PERMANENTLY_REDUCED,
};

/** The statuses the guest sync writes for someone whose residence is settled. */
const SECURE_RESIDENCE_STATUS = new Set(["Citizen", "PermanentResident"]);

const COUPLE_MARITAL_STATUS = new Set([
	"Married",
	"Cohabiting",
	"Registered Civil Partnership",
]);

const citizenshipFrom = (
	profile: Profile,
): Pick<
	PartialBenefitCheckAnswers,
	"citizenship" | "hasSecureResidenceStatus"
> => {
	const isGermanCitizen = profile.personalData?.isGermanCitizen;
	const residenceStatus = profile.personalData?.residenceStatus;

	if (isGermanCitizen === true) {
		return { citizenship: Citizenship.DE_EU };
	}
	if (isGermanCitizen === false && residenceStatus) {
		return {
			citizenship: Citizenship.NON_EU,
			hasSecureResidenceStatus: SECURE_RESIDENCE_STATUS.has(residenceStatus),
		};
	}
	return {};
};

const compositionFor = (
	isCouple: boolean,
	hasChildren: boolean,
): HouseholdComposition => {
	if (isCouple) {
		return hasChildren
			? HouseholdComposition.COUPLE_WITH_CHILDREN
			: HouseholdComposition.COUPLE_NO_CHILDREN;
	}
	return hasChildren
		? HouseholdComposition.SINGLE_PARENT
		: HouseholdComposition.SINGLE;
};

/**
 * The household count is adults plus children, so anything above the adults is a child.
 *
 * Only the childless case writes `children`. Their ages are not on the profile — the
 * collection `mapProfileToFrontend` drops — so a household WITH children leaves the list
 * unanswered rather than inventing one.
 */
const householdFrom = (profile: Profile): PartialBenefitCheckAnswers => {
	const maritalStatus =
		profile.household?.maritalStatus ?? profile.personalData?.maritalStatus;
	const householdSize = profile.household?.personsInHouseholdCount;
	if (!maritalStatus || householdSize === undefined) {
		return {};
	}

	const isCouple = COUPLE_MARITAL_STATUS.has(maritalStatus);
	const hasChildren = householdSize > (isCouple ? 2 : 1);

	return {
		householdComposition: compositionFor(isCouple, hasChildren),
		...(hasChildren ? {} : { children: [] }),
	};
};

/**
 * Reads the answers back out of a saved profile, so the dashboard can work out which
 * benefits fit without storing a verdict of its own.
 *
 * Three of the questionnaire's answers have no column on `users` — the gross income, the
 * savings band and the warm rent — so they stay `undefined` here. That is deliberate and
 * load-bearing: the rules turn missing data into CHECK_ADVISED, never into a rejection, so
 * a benefit whose decision needs money always stays on the dashboard. What this mapping CAN
 * decide are the categorical gates — age, work capacity, residence, whether a benefit is
 * already drawn, whether there are children at all — and those are exactly the cases where
 * offering the form would be pointless rather than merely uncertain.
 */
export const profileToBenefitAnswers = (
	profile: Profile,
): PartialBenefitCheckAnswers => {
	const ability = profile.health?.abilityToWork;
	const monthlyIncome = profile.financial?.monthlyIncome;
	const awaitingDecision =
		profile.financial?.hasAppliedForBenefitsAwaitingDecision;

	return {
		...(profile.personalData?.dateOfBirth
			? { dateOfBirth: profile.personalData.dateOfBirth }
			: {}),
		...(ability && WORK_CAPACITY_BY_ABILITY[ability]
			? { workCapacity: WORK_CAPACITY_BY_ABILITY[ability] }
			: {}),
		...citizenshipFrom(profile),
		...householdFrom(profile),
		...(typeof monthlyIncome === "number"
			? { monthlyNetHouseholdIncome: monthlyIncome }
			: {}),
		...(awaitingDecision === true ? { receivesBenefitsAlready: true } : {}),
	};
};
