import type { Profile } from "../../../schemas/profile.schema";
import type { CombinedWizardFormValues } from "./types";

/**
 * Converts an untouched/cleared number input ("") to undefined rather than
 * NaN, so optional numeric fields don't fail validation until a value is
 * actually entered.
 */
export const emptyStringToUndefinedNumber = (
	value: string,
): number | undefined => (value === "" ? undefined : Number(value));

/**
 * Flattens what is actually saved, without the placeholder values the selects
 * below need, so an untouched profile does not read as partially filled.
 */
export function getSavedProfileFields(
	profileData: Profile | null | undefined,
): Record<string, unknown> {
	if (!profileData) {
		return {};
	}

	const financial = profileData.financial || {};

	return {
		...profileData.personalData,
		...profileData.address,
		...profileData.contact,
		...profileData.vehicle,
		...financial,
		...financial.bankDetails,
		...profileData.household,
		...profileData.housing,
		...profileData.health,
	};
}

export function getProfileFormDefaults(
	profileData: Profile | null | undefined,
): CombinedWizardFormValues {
	const base: CombinedWizardFormValues = {
		firstName: "",
		lastName: "",
		dateOfBirth: "",
		placeOfBirth: "",
		legalGender: "Diverse",
		nationality: "",
		secondNationality: "",
		maritalStatus: "Single",
		street: "",
		houseNumber: "",
		zipCode: "",
		city: "",
		birthName: "",
		residenceStatus: "",
		identificationNumbers: "",
		taxId: "",
		state: "Berlin",
		incomeSources: [],
	};

	if (!profileData) {
		return base;
	}

	const personal = profileData.personalData || {};
	const addr = profileData.address || {};
	const contact = profileData.contact || {};
	const vehicle = profileData.vehicle || {};
	const financial = profileData.financial || {};
	const bank = financial.bankDetails || {};
	const household = profileData.household || {};
	const housing = profileData.housing || {};
	const health = profileData.health || {};

	return {
		...base,
		...personal,
		...addr,
		...contact,
		...vehicle,
		...financial,
		...bank,
		...household,
		...housing,
		...health,
		legalGender: personal.legalGender || "Diverse",
		maritalStatus: personal.maritalStatus || "Single",
		state: addr.state || "Berlin",
		incomeSources: financial.incomeSources || [],
	};
}

/** Maps every flat edit-form field to the Profile section it belongs to. */
export const FIELD_SECTION: Record<string, keyof Profile> = {
	// address
	street: "address",
	houseNumber: "address",
	zipCode: "address",
	city: "address",
	state: "address",
	// contact
	email: "contact",
	phoneNumber: "contact",
	// vehicle
	licensePlate: "vehicle",
	// household
	personsInHouseholdCount: "household",
	marriedSince: "household",
	// housing
	accomodationType: "housing",
	tenancyStatus: "housing",
	rentTotal: "housing",
	heatingCosts: "housing",
	hotWaterCosts: "housing",
	cableTvCosts: "housing",
	livingArea: "housing",
	numberOfRooms: "housing",
	subletRoomCount: "housing",
	subletRentIncome: "housing",
	rentPaidUntil: "housing",
	landlordName: "housing",
	heatingType: "housing",
	freeHousingRightHolder: "housing",
	isSubsidizedHousing: "housing",
	hasOtherResidence: "housing",
	hasSecondaryResidence: "housing",
	hasGarageCosts: "housing",
	garageCosts: "housing",
	hasHouseholdEnergyCosts: "housing",
	householdEnergyCosts: "housing",
	isLivingAreaUsedCommercially: "housing",
	commerciallyUsedAreaSqm: "housing",
	// financial
	monthlyIncome: "financial",
	incomeSources: "financial",
	hasAssets: "financial",
	assetsDescription: "financial",
	professionalExpenses: "financial",
	hasChildcareExpenses: "financial",
	gaveAwayAssetsLast10Years: "financial",
	grossNegligenceLast10Years: "financial",
	hasAppliedForBenefitsAwaitingDecision: "financial",
	benefitsAwaitingDecisionType: "financial",
	benefitsAwaitingDecisionApplicationDate: "financial",
	benefitsAwaitingDecisionOffice: "financial",
	benefitsAwaitingDecisionReference: "financial",
	areOneTimePaymentsExpected: "financial",
	oneTimePaymentsExpectedType: "financial",
	oneTimePaymentsExpectedAmount: "financial",
	oneTimePaymentsExpectedDate: "financial",
	bankName: "financial",
	accountHolder: "financial",
	iban: "financial",
	bic: "financial",
	// health
	hasDisabilityId: "health",
	disabilityValidUntil: "health",
	merkzeichen: "health",
	disabilityApplicationPending: "health",
	hasCostlyMedicalNutrition: "health",
	isCareDependent: "health",
	hasInpatientFacilityAccommodation: "health",
	inpatientFacilityMoveInDate: "health",
	inpatientFacilityLastResidence: "health",
	reducedWorkCapacityStartDate: "health",
	reducedWorkCapacityEndDate: "health",
	reducedWorkCapacityReason: "health",
	abilityToWork: "health",
	hasPermanentReductionInEarningCapacity: "health",
};

/** Bank fields nest under financial.bankDetails rather than sitting flat on financial. */
export const BANK_FIELDS = new Set([
	"bankName",
	"accountHolder",
	"iban",
	"bic",
]);
