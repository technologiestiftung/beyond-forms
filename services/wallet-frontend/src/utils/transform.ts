import { DEFAULT_LOCALE } from "../constants/locale";
import { PersonalDataSchema, ProfileSchema } from "../schemas/profile.schema";
import type {
	PersonalData,
	Profile,
	MaritalStatusType,
	FinancialData,
	AbilityToWorkType,
	DisabilityMerkzeichenType,
} from "../schemas/profile.schema";

/**
 * Recursively replaces empty strings ("") with null in object payloads,
 * ensuring cleared fields can be saved as NULL in the database.
 */
export const sanitizeDraftPayload = (val: unknown): unknown => {
	if (val === "") {
		return null;
	}
	if (Array.isArray(val)) {
		return val.map(sanitizeDraftPayload);
	}
	if (val !== null && typeof val === "object" && !(val instanceof Date)) {
		return Object.keys(val as Record<string, unknown>).reduce(
			(acc, key) => {
				const rawVal = (val as Record<string, unknown>)[key];
				acc[key] = sanitizeDraftPayload(rawVal);
				return acc;
			},
			{} as Record<string, unknown>,
		);
	}
	return val;
};

/**
 * Recursively converts object keys to camelCase.
 * Handles arrays and nested objects.
 */
export const toCamelCase = (val: unknown): unknown => {
	if (Array.isArray(val)) {
		return val.map(toCamelCase);
	}
	if (val !== null && typeof val === "object" && !(val instanceof Date)) {
		return Object.keys(val as Record<string, unknown>).reduce(
			(acc, key) => {
				const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) =>
					letter.toUpperCase(),
				);
				acc[camelKey] = toCamelCase((val as Record<string, unknown>)[key]);
				return acc;
			},
			{} as Record<string, unknown>,
		);
	}
	return val;
};

/**
 * Recursively converts object keys to snake_case.
 * Handles arrays and nested objects.
 */
export const toSnakeCase = (val: unknown): unknown => {
	if (Array.isArray(val)) {
		return val.map(toSnakeCase);
	}
	if (val !== null && typeof val === "object" && !(val instanceof Date)) {
		return Object.keys(val as Record<string, unknown>).reduce(
			(acc, key) => {
				const snakeKey = key.replace(
					/[A-Z]/g,
					(letter, index) => (index > 0 ? "_" : "") + letter.toLowerCase(),
				);
				acc[snakeKey] = toSnakeCase((val as Record<string, unknown>)[key]);
				return acc;
			},
			{} as Record<string, unknown>,
		);
	}
	return val;
};

/**
 * Safely maps frontend PersonalData to backend snake_case format.
 */
export const mapPersonalDataToBackend = (
	data: Partial<PersonalData>,
): Record<string, unknown> => {
	return toSnakeCase(data) as Record<string, unknown>;
};

export const mapFinancialDataToBackend = (
	data: Partial<FinancialData>,
): Record<string, unknown> => {
	const payload = toSnakeCase(data) as Record<string, unknown>;
	if (data.bankDetails) {
		const bankDetails = toSnakeCase(data.bankDetails) as Record<
			string,
			unknown
		>;
		Object.assign(payload, bankDetails);
		delete payload.bank_details;
	}
	return payload;
};

/**
 * Safely maps backend snake_case PersonalData to frontend camelCase format.
 */
export const mapPersonalDataToFrontend = (
	data: Record<string, unknown>,
): PersonalData => {
	const camelData = toCamelCase(data);
	return PersonalDataSchema.parse(camelData);
};

/**
 * Safely maps full backend profile to frontend camelCase format.
 * Handles both flat backend structure and nested structure (for tests).
 */
export const mapProfileToFrontend = (
	data: Record<string, unknown>,
): Profile => {
	const camelData = toCamelCase(data) as Record<string, unknown>;

	const getVal = <T>(key: string): T | undefined => {
		const val = camelData[key];
		return val === null ? undefined : (val as T | undefined);
	};

	const personalData = (camelData["personalData"] as
		Record<string, unknown> | undefined) || {
		firstName: getVal<string>("firstName"),
		lastName: getVal<string>("lastName"),
		dateOfBirth: getVal<string>("dateOfBirth"),
		placeOfBirth: getVal<string>("placeOfBirth"),
		legalGender: getVal<string>("legalGender"),
		nationality: getVal<string>("nationality"),
		secondNationality: getVal<string>("secondNationality"),
		maritalStatus: getVal<MaritalStatusType>("maritalStatus"),
		birthName: getVal<string>("birthName"),
		residenceStatus: getVal<string>("residenceStatus"),
		isGermanCitizen: getVal<boolean>("isGermanCitizen"),
		identificationNumbers: getVal<string>("identificationNumbers"),
		taxId: getVal<string>("taxId"),
		hasCustodian: getVal<boolean>("hasCustodian"),
		hasGuardian: getVal<boolean>("hasGuardian"),
		displacedStatus: getVal<string>("displacedStatus"),
		displacedIssuedOn: getVal<string>("displacedIssuedOn"),
		displacedIssuedBy: getVal<string>("displacedIssuedBy"),
		socialSecurityType: getVal<string>("socialSecurityType"),
		healthInsuranceStatus: getVal<string>("healthInsuranceStatus"),
		hasAppliedForAsylumBenefits: getVal<boolean>("hasAppliedForAsylumBenefits"),
		hasReceivedPreviousBenefits: getVal<boolean>("hasReceivedPreviousBenefits"),
		previousBenefitsPeriod: getVal<string>("previousBenefitsPeriod"),
		previousBenefitsAuthority: getVal<string>("previousBenefitsAuthority"),
		previousBenefitsRefNo: getVal<string>("previousBenefitsRefNo"),
		isCurrentlyEmployed: getVal<boolean>("isCurrentlyEmployed"),
	};

	const address = (camelData["address"] as
		Record<string, unknown> | undefined) || {
		street: getVal<string>("street"),
		houseNumber: getVal<string>("houseNumber"),
		zipCode: getVal<string>("zipCode"),
		city: getVal<string>("city"),
		state: getVal<string>("state"),
		district: getVal<string>("district"),
	};

	const contact = (camelData["contact"] as
		Record<string, unknown> | undefined) || {
		email: getVal<string>("email"),
		phoneNumber: getVal<string>("phoneNumber"),
	};

	const financial = (camelData["financial"] as
		Record<string, unknown> | undefined) || {
		bankDetails: (camelData["bankDetails"] as
			Record<string, unknown> | undefined) || {
			bankName: getVal<string>("bankName"),
			accountHolder: getVal<string>("accountHolder"),
			iban: getVal<string>("iban"),
			bic: getVal<string>("bic"),
		},
		monthlyIncome: getVal<number>("monthlyIncome"),
		hasAssets: getVal<boolean>("hasAssets"),
		assetsDescription: getVal<string>("assetsDescription"),
		incomeSources: getVal<string[]>("incomeSources") || [],
		assetsTypes: getVal<string[]>("assetsTypes") || [],
		hasAppliedForBenefitsAwaitingDecision: getVal<boolean>(
			"hasAppliedForBenefitsAwaitingDecision",
		),
		benefitsAwaitingDecisionType: getVal<string>(
			"benefitsAwaitingDecisionType",
		),
		benefitsAwaitingDecisionApplicationDate: getVal<string>(
			"benefitsAwaitingDecisionApplicationDate",
		),
		benefitsAwaitingDecisionOffice: getVal<string>(
			"benefitsAwaitingDecisionOffice",
		),
		benefitsAwaitingDecisionReference: getVal<string>(
			"benefitsAwaitingDecisionReference",
		),
		areOneTimePaymentsExpected: getVal<boolean>("areOneTimePaymentsExpected"),
		oneTimePaymentsExpectedType: getVal<string>("oneTimePaymentsExpectedType"),
		oneTimePaymentsExpectedAmount: getVal<number>(
			"oneTimePaymentsExpectedAmount",
		),
		oneTimePaymentsExpectedDate: getVal<string>("oneTimePaymentsExpectedDate"),
	};

	const household = (camelData["household"] as
		Record<string, unknown> | undefined) || {
		personsInHouseholdCount: getVal<number>("personsInHouseholdCount"),
		maritalStatus: getVal<MaritalStatusType>("maritalStatus"),
		marriedSince: getVal<string>("marriedSince"),
	};

	const housing = (camelData["housing"] as
		Record<string, unknown> | undefined) || {
		accomodationType: getVal<string>("accomodationType"),
		tenancyStatus: getVal<string>("tenancyStatus"),
		rentTotal: getVal<number>("rentTotal"),
		heatingCosts: getVal<number>("heatingCosts"),
		livingArea: getVal<number>("livingArea"),
		numberOfRooms: getVal<number>("numberOfRooms"),
	};

	const health = (camelData["health"] as
		Record<string, unknown> | undefined) || {
		hasDisabilityId: getVal<boolean>("hasDisabilityId"),
		hasCostlyMedicalNutrition: getVal<boolean>("hasCostlyMedicalNutrition"),
		isCareDependent: getVal<boolean>("isCareDependent"),
		hasInpatientFacilityAccommodation: getVal<boolean>(
			"hasInpatientFacilityAccommodation",
		),
		inpatientFacilityMoveInDate: getVal<string>("inpatientFacilityMoveInDate"),
		inpatientFacilityLastResidence: getVal<string>(
			"inpatientFacilityLastResidence",
		),
		reducedWorkCapacityStartDate: getVal<string>(
			"reducedWorkCapacityStartDate",
		),
		reducedWorkCapacityEndDate: getVal<string>("reducedWorkCapacityEndDate"),
		reducedWorkCapacityReason: getVal<string>("reducedWorkCapacityReason"),
		abilityToWork: getVal<AbilityToWorkType>("abilityToWork"),
		disabilityValidUntil: getVal<string>("disabilityValidUntil"),
		merkzeichen: getVal<DisabilityMerkzeichenType>("merkzeichen"),
	};

	const documents = (camelData["documents"] as unknown[]) || [];
	const settings = (camelData["settings"] as
		Record<string, unknown> | undefined) || {
		language: DEFAULT_LOCALE,
		notificationsEnabled: true,
		personaAddress: "Formal",
		displayName: getVal<string>("displayName"),
	};

	const profile = {
		personalData,
		address,
		contact,
		financial,
		household,
		housing,
		health,
		documents,
		settings,
	};

	return ProfileSchema.extend({
		personalData: PersonalDataSchema.partial(),
	}).parse(profile) as unknown as Profile;
};

/**
 * Flattens full frontend profile and converts keys to snake_case for backend.
 */
export const mapProfileToBackend = (
	profile: Profile,
): Record<string, unknown> => {
	const sections = [
		profile.personalData,
		profile.address,
		profile.contact,
		profile.financial,
		profile.household,
		profile.housing,
		profile.health,
		profile.settings,
	];

	const flatData: Record<string, unknown> = {};

	for (const section of sections) {
		if (!section) {
			continue;
		}
		const snakeSection = toSnakeCase(section) as Record<string, unknown>;
		for (const [key, value] of Object.entries(snakeSection)) {
			if (value !== undefined) {
				flatData[key] = value;
			}
		}
	}

	// Flatten bankDetails
	if (profile.financial?.bankDetails) {
		const bankDetails = toSnakeCase(profile.financial.bankDetails) as Record<
			string,
			unknown
		>;
		for (const [key, value] of Object.entries(bankDetails)) {
			if (value !== undefined) {
				flatData[key] = value;
			}
		}
		delete flatData.bank_details;
	}

	return flatData;
};

/**
 * Maps a single backend snake_case key to its frontend camelCase equivalent.
 */
export const mapBackendKeyToFrontendKey = (backendKey: string): string => {
	return backendKey.replace(/_([a-z0-9])/g, (_, letter) =>
		letter.toUpperCase(),
	);
};
