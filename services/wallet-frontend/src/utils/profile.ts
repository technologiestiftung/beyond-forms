import React from "react";
import type { TFunction } from "i18next";
import type { Profile, WalletDocument } from "../schemas/profile.schema";
import {
	MVP_SKIPPED_CATEGORIES,
	REQUIRED_DOCUMENT_SLOTS,
	type RequiredDocumentSlot,
} from "../config/applicationConfig";
import { AppRoutes } from "../constants/routes";
import {
	EuroIcon,
	CrossIcon,
	HouseIcon,
	UsersIcon,
	UserIcon,
} from "../components/ui/Icons";
import {
	MAX_MILESTONE_LEVEL,
	type MilestoneLevel,
} from "../store/useProfileStore";

export const getActiveSkippedCategories = (
	profile: Partial<Profile>,
): string[] => {
	const skipped = [...MVP_SKIPPED_CATEGORIES];
	if (profile.health?.hasInpatientFacilityAccommodation === true) {
		skipped.push("housing");
	}
	return skipped;
};

/**
 * Pure utility to calculate completion metrics based on profile data.
 */
export const calculateCompletionPercentage = (
	profile: Partial<Profile>,
): number => {
	const sections = getMappedInformationSections(profile);
	if (sections.length === 0) {
		return 0;
	}
	const skipped = getActiveSkippedCategories(profile);
	const activeSections = sections.filter((s) => !skipped.includes(s.id));
	if (activeSections.length === 0) {
		return 100;
	}
	const completedCount = activeSections.filter((s) => s.completed).length;
	return Math.round((completedCount / activeSections.length) * 100);
};

export interface MappedInformationSection {
	id: string;
	titleKey?: string;
	title: string;
	icon: React.ElementType;
	subtitleKey?: string;
	subtitle: string;
	badgeKey?: string;
	badge: string;
	completed: boolean;
	route: string;
	questionsRoute?: string;
	totalQuestions?: number;
	answeredQuestions?: number;
}

const ABOUT_ME_STEPS_BASE = 5;
const ABOUT_ME_STEPS_NO_ADDRESS = 6;
const HOUSEHOLD_TOTAL_STEPS = 5;
const INCOME_ASSETS_TOTAL_STEPS = 7;

/* eslint-disable complexity */
const getAboutMeStats = (
	profile: Partial<Profile>,
): { totalQuestions: number; answeredQuestions: number } => {
	let answered = 0;
	if (profile.personalData?.firstName && profile.personalData?.lastName) {
		answered++;
	}
	if (profile.personalData?.dateOfBirth && profile.personalData?.placeOfBirth) {
		answered++;
	}
	if (profile.personalData?.legalGender) {
		answered++;
	}
	const noAddr = profile.address?.street === "ohne feste Adresse";
	const hasFixedAddr = !!(
		profile.address?.street &&
		profile.address?.zipCode &&
		profile.address?.city
	);
	if (noAddr || hasFixedAddr) {
		answered++;
	}
	if (noAddr && profile.address?.state) {
		answered++;
	}
	if (
		profile.personalData?.isGermanCitizen !== undefined &&
		profile.personalData?.isGermanCitizen !== null
	) {
		answered++;
	}
	const total = noAddr ? ABOUT_ME_STEPS_NO_ADDRESS : ABOUT_ME_STEPS_BASE;
	return { totalQuestions: total, answeredQuestions: answered };
};

const getHouseholdStats = (
	profile: Partial<Profile>,
): { totalQuestions: number; answeredQuestions: number } => {
	let answered = 0;
	if (
		profile.personalData?.hasCustodian !== undefined ||
		profile.personalData?.hasGuardian !== undefined
	) {
		answered++;
	}
	if (
		profile.personalData?.displacedStatus !== undefined &&
		profile.personalData?.displacedStatus !== null
	) {
		answered++;
	}
	if (
		profile.personalData?.socialSecurityType !== undefined ||
		profile.personalData?.healthInsuranceStatus !== undefined
	) {
		answered++;
	}
	if (profile.household?.personsInHouseholdCount !== undefined) {
		answered++;
	}
	if (profile.household?.maritalStatus) {
		answered++;
	}
	return { totalQuestions: HOUSEHOLD_TOTAL_STEPS, answeredQuestions: answered };
};

const getTenancyStats = (
	housing: NonNullable<Profile["housing"]>,
): { total: number; answered: number } => {
	let total = 0;
	let answered = 0;
	if (housing.tenancyStatus === "Subtenant") {
		total += 2; // Landlord Name, Arrears
		if (housing.landlordName) {
			answered++;
		}
		if (housing.rentPaidUntil) {
			answered++;
		}
	} else if (housing.tenancyStatus === "Main Tenant") {
		total += 2; // Sublet room count, Arrears
		if (housing.subletRoomCount !== undefined) {
			answered++;
		}
		if (housing.rentPaidUntil) {
			answered++;
		}
	}
	return { total, answered };
};

const getHousingStats = (
	profile: Partial<Profile>,
): { totalQuestions: number; answeredQuestions: number } => {
	let total = 2; // Address, Type
	let answered = 0;

	// Address check
	const noAddr = profile.address?.street === "ohne feste Adresse";
	const hasAddr = !!(
		profile.address?.street &&
		profile.address?.zipCode &&
		profile.address?.city
	);
	if (noAddr || hasAddr) {
		answered++;
	}
	if (noAddr) {
		total++; // Letzter Wohnort
		if (profile.address?.state) {
			answered++;
		}
	}

	if (profile.housing?.accomodationType) {
		answered++;
		if (profile.housing.accomodationType === "Rental Apartment") {
			total += 5; // Tenancy, Costs, Area, Rooms, Heating
			if (profile.housing.tenancyStatus) {
				answered++;
				const tStats = getTenancyStats(profile.housing);
				total += tStats.total;
				answered += tStats.answered;
			}
			if (
				profile.housing.rentTotal !== undefined &&
				profile.housing.rentTotal !== 0
			) {
				answered++;
			}
			if (
				profile.housing.heatingCosts !== undefined &&
				profile.housing.heatingCosts !== 0
			) {
				answered++;
			}
			if (
				profile.housing.livingArea !== undefined &&
				profile.housing.livingArea !== 0
			) {
				answered++;
			}
			if (profile.housing.heatingType) {
				answered++;
			}
		} else if (profile.housing.accomodationType === "Own Home") {
			total += 4; // Sublet room count, Costs, Area, Heating
			if (profile.housing.subletRoomCount !== undefined) {
				answered++;
			}
			if (
				profile.housing.rentTotal !== undefined &&
				profile.housing.rentTotal !== 0
			) {
				answered++;
			}
			if (
				profile.housing.livingArea !== undefined &&
				profile.housing.livingArea !== 0
			) {
				answered++;
			}
			if (profile.housing.heatingType) {
				answered++;
			}
		} else if (profile.housing.freeHousingRightHolder) {
			// Freies Wohnrecht
			total = noAddr ? 4 : 3; // Address, Type, Tenancy, Holder Name
			answered++; // holder name answered
		}
	}
	return { totalQuestions: total, answeredQuestions: answered };
};

const getIncomeAssetsStats = (
	profile: Partial<Profile>,
): { totalQuestions: number; answeredQuestions: number } => {
	let answered = 0;
	if (
		profile.financial?.hasAppliedForBenefitsAwaitingDecision !== undefined &&
		profile.financial?.hasAppliedForBenefitsAwaitingDecision !== null
	) {
		answered++;
	}
	if (
		profile.personalData?.hasReceivedPreviousBenefits !== undefined &&
		profile.personalData?.hasReceivedPreviousBenefits !== null
	) {
		answered++;
	}
	if (
		profile.financial?.incomeSources &&
		(profile.financial.incomeSources.includes("pension") ||
			profile.financial.incomeSources.includes("none_pension"))
	) {
		answered++;
	}
	if (
		profile.personalData?.isCurrentlyEmployed !== undefined &&
		profile.personalData?.isCurrentlyEmployed !== null
	) {
		answered++;
	}
	if (
		profile.financial?.incomeSources &&
		(profile.financial.incomeSources.includes("other_benefits") ||
			profile.financial.incomeSources.includes("other") ||
			profile.financial.incomeSources.includes("none_other"))
	) {
		answered++;
	}
	if (
		profile.financial?.areOneTimePaymentsExpected !== undefined &&
		profile.financial?.areOneTimePaymentsExpected !== null
	) {
		answered++;
	}
	if (
		profile.financial?.bankDetails?.iban &&
		profile.financial?.bankDetails?.accountHolder
	) {
		answered++;
	}
	return {
		totalQuestions: INCOME_ASSETS_TOTAL_STEPS,
		answeredQuestions: answered,
	};
};

const getCareDependencyStats = (
	health: Profile["health"],
): { total: number; answered: number } => {
	let total = 0;
	let answered = 0;

	if (
		health?.isCareDependent === undefined ||
		health?.isCareDependent === null
	) {
		return { total, answered };
	}

	answered++;

	if (health.isCareDependent !== true) {
		return { total, answered };
	}

	total++;

	if (
		health.hasInpatientFacilityAccommodation === undefined ||
		health.hasInpatientFacilityAccommodation === null
	) {
		return { total, answered };
	}

	answered++;

	if (health.hasInpatientFacilityAccommodation !== true) {
		return { total, answered };
	}

	total += 2;
	if (health.inpatientFacilityMoveInDate) {
		answered++;
	}
	if (health.inpatientFacilityLastResidence) {
		answered++;
	}

	return { total, answered };
};

const getEarningCapacityStats = (
	health: Profile["health"],
): { total: number; answered: number } => {
	let total = 0;
	let answered = 0;

	if (!health?.abilityToWork) {
		return { total, answered };
	}

	answered++;

	if (health.abilityToWork === "Permanently disabled") {
		total += 3;
		if (health.reducedWorkCapacityStartDate) {
			answered++;
		}
		if (health.reducedWorkCapacityReason) {
			answered++;
		}

		if (
			health.hasDisabilityId === undefined ||
			health.hasDisabilityId === null
		) {
			return { total, answered };
		}

		answered++;

		if (health.hasDisabilityId !== true) {
			return { total, answered };
		}

		total += 2;
		if (health.disabilityValidUntil) {
			answered++;
		}
		if (health.merkzeichen) {
			answered++;
		}
	} else if (health.abilityToWork === "Temporarily disabled") {
		total += 3; // Start date, End date, Reason
		if (health.reducedWorkCapacityStartDate) {
			answered++;
		}
		if (health.reducedWorkCapacityEndDate) {
			answered++;
		}
		if (health.reducedWorkCapacityReason) {
			answered++;
		}
	}

	return { total, answered };
};

const getHealthStats = (
	profile: Partial<Profile>,
): { totalQuestions: number; answeredQuestions: number } => {
	let total = 2;
	let answered = 0;

	if (profile.health) {
		const care = getCareDependencyStats(profile.health);
		total += care.total;
		answered += care.answered;

		const earn = getEarningCapacityStats(profile.health);
		total += earn.total;
		answered += earn.answered;
	}

	return { totalQuestions: total, answeredQuestions: answered };
};

export const getQuestionnaireStats = (
	id: string,
	profile: Partial<Profile>,
): { totalQuestions: number; answeredQuestions: number } | null => {
	if (id === "about_me") {
		return getAboutMeStats(profile);
	}
	if (id === "household") {
		return getHouseholdStats(profile);
	}
	if (id === "housing") {
		return getHousingStats(profile);
	}
	if (id === "income_assets") {
		return getIncomeAssetsStats(profile);
	}
	if (id === "health") {
		return getHealthStats(profile);
	}
	return null;
};

/**
 * Dynamically maps profile data into the 6 core information sections required by the high-fidelity UI.
 * Fully resolves "finalized" completion states based on database/profile non-empty field checks.
 */
/* eslint-disable complexity */
export const getMappedInformationSections = (
	profile: Partial<Profile>,
	t?: TFunction,
): MappedInformationSection[] => {
	const hasValidAddress = !!(
		(profile.address?.street &&
			profile.address?.houseNumber &&
			profile.address?.zipCode &&
			profile.address?.city) ||
		(profile.address?.street === "ohne feste Adresse" && profile.address?.state)
	);

	const hasPersonal = !!(
		profile.personalData?.firstName &&
		profile.personalData?.lastName &&
		profile.personalData?.dateOfBirth &&
		profile.personalData?.placeOfBirth &&
		profile.personalData?.legalGender &&
		hasValidAddress &&
		profile.personalData?.isGermanCitizen !== undefined &&
		profile.personalData?.isGermanCitizen !== null &&
		profile.personalData?.nationality
	);

	const hasFamilyStatus = !!(
		(profile.personalData?.hasCustodian !== undefined ||
			profile.personalData?.hasGuardian !== undefined) &&
		profile.personalData?.displacedStatus !== undefined &&
		(profile.personalData?.socialSecurityType !== undefined ||
			profile.personalData?.healthInsuranceStatus !== undefined) &&
		profile.household?.personsInHouseholdCount !== undefined &&
		profile.household?.maritalStatus
	);

	const hasHousing = !!(
		profile.housing?.accomodationType ||
		profile.housing?.rentTotal ||
		profile.housing?.livingArea
	);

	const incomeAssetsStats = getQuestionnaireStats("income_assets", profile);
	const hasIncomeAssets = !!(
		incomeAssetsStats &&
		incomeAssetsStats.answeredQuestions === incomeAssetsStats.totalQuestions
	);

	const healthStats = getQuestionnaireStats("health", profile);
	const hasHealth = !!(
		healthStats &&
		healthStats.answeredQuestions === healthStats.totalQuestions &&
		healthStats.totalQuestions > 0
	);

	const aboutMeStats = getQuestionnaireStats("about_me", profile);
	const householdStats = getQuestionnaireStats("household", profile);
	const housingStats = getQuestionnaireStats("housing", profile);

	return [
		{
			id: "about_me",
			titleKey: "questionnaire.sections.about_me.title",
			title:
				t?.("questionnaire.sections.about_me.title", "Über Dich") ||
				"Über Dich",
			icon: UserIcon,
			subtitleKey: "questionnaire.sections.about_me.subtitle",
			subtitle:
				t?.(
					"questionnaire.sections.about_me.subtitle",
					"Hier findest Du Deine personenbezogenen Daten.",
				) || "Hier findest Du Deine personenbezogenen Daten.",
			badgeKey: "questionnaire.badges.personal",
			badge:
				t?.("questionnaire.badges.personal", "Persönliche Angaben") ||
				"Persönliche Angaben",
			completed: hasPersonal,
			route: AppRoutes.ApplicationAboutMeIntro,
			questionsRoute: AppRoutes.ApplicationAboutMeQuestions,
			totalQuestions: aboutMeStats?.totalQuestions,
			answeredQuestions: aboutMeStats?.answeredQuestions,
		},
		{
			id: "income_assets",
			titleKey: "questionnaire.sections.income_assets.title",
			title:
				t?.(
					"questionnaire.sections.income_assets.title",
					"Dein Einkommen, Ersparnisse und Wertsachen",
				) || "Dein Einkommen, Ersparnisse und Wertsachen",
			icon: EuroIcon,
			subtitleKey: "questionnaire.sections.income_assets.subtitle",
			subtitle:
				t?.(
					"questionnaire.sections.income_assets.subtitle",
					"Wir erfassen, welches Geld Du regelmäßig bekommst und was Du nachweisen musst und wir prüfen, was Du angeben musst und welche Nachweise dazu wichtig sind.",
				) ||
				"Wir erfassen, welches Geld Du regelmäßig bekommst und was Du nachweisen musst und wir prüfen, was Du angeben musst und welche Nachweise dazu wichtig sind.",
			badgeKey: "questionnaire.badges.personal",
			badge:
				t?.("questionnaire.badges.personal", "Persönliche Angaben") ||
				"Persönliche Angaben",
			completed: hasIncomeAssets,
			route: AppRoutes.ApplicationIncomeAssetsIntro,
			questionsRoute: AppRoutes.ApplicationIncomeAssetsQuestions,
			totalQuestions: incomeAssetsStats?.totalQuestions,
			answeredQuestions: incomeAssetsStats?.answeredQuestions,
		},
		{
			id: "housing",
			titleKey: "questionnaire.sections.housing.title",
			title:
				t?.("questionnaire.sections.housing.title", "Dein Wohnen") ||
				"Dein Wohnen",
			icon: HouseIcon,
			subtitleKey: "questionnaire.sections.housing.subtitle",
			subtitle:
				t?.(
					"questionnaire.sections.housing.subtitle",
					"Wir klären, welche Angaben und Unterlagen Du zu Deiner Wohnsituation brauchst.",
				) ||
				"Wir klären, welche Angaben und Unterlagen Du zu Deiner Wohnsituation brauchst.",
			badgeKey: "questionnaire.badges.personal",
			badge:
				t?.("questionnaire.badges.personal", "Persönliche Angaben") ||
				"Persönliche Angaben",
			completed: hasHousing,
			route: AppRoutes.ApplicationHousingIntro,
			questionsRoute: AppRoutes.ApplicationHousingQuestions,
			totalQuestions: housingStats?.totalQuestions,
			answeredQuestions: housingStats?.answeredQuestions,
		},
		{
			id: "health",
			titleKey: "questionnaire.sections.health.title",
			title:
				t?.(
					"questionnaire.sections.health.title",
					"Gesundheit und zusätzlicher Bedarf",
				) || "Gesundheit und zusätzlicher Bedarf",
			icon: CrossIcon,
			subtitleKey: "questionnaire.sections.health.subtitle",
			subtitle:
				t?.(
					"questionnaire.sections.health.subtitle",
					"Wir klären, ob Du wegen Krankheit oder Behinderung mehr Unterstützung bekommen kannst.",
				) ||
				"Wir klären, ob Du wegen Krankheit oder Behinderung mehr Unterstützung bekommen kannst.",
			badgeKey: "questionnaire.badges.personal",
			badge:
				t?.("questionnaire.badges.personal", "Persönliche Angaben") ||
				"Persönliche Angaben",
			completed: hasHealth,
			route: AppRoutes.ApplicationHealthIntro,
			questionsRoute: AppRoutes.ApplicationHealthQuestions,
			totalQuestions: healthStats?.totalQuestions,
			answeredQuestions: healthStats?.answeredQuestions,
		},
		{
			id: "household",
			titleKey: "questionnaire.sections.household.title",
			title:
				t?.("questionnaire.sections.household.title", "Familie und Haushalt") ||
				"Familie und Haushalt",
			icon: UsersIcon,
			subtitleKey: "questionnaire.sections.household.subtitle",
			subtitle:
				t?.(
					"questionnaire.sections.household.subtitle",
					"Wir erfassen Deine Wohn- und Lebenssituation und welche Bedarfe sich ergeben.",
				) ||
				"Wir erfassen Deine Wohn- und Lebenssituation und welche Bedarfe sich ergeben.",
			badgeKey: "questionnaire.badges.personal",
			badge:
				t?.("questionnaire.badges.personal", "Persönliche Angaben") ||
				"Persönliche Angaben",
			completed: hasFamilyStatus,
			route: AppRoutes.ApplicationHouseholdIntro,
			questionsRoute: AppRoutes.ApplicationHouseholdQuestions,
			totalQuestions: householdStats?.totalQuestions,
			answeredQuestions: householdStats?.answeredQuestions,
		},
	];
};

export const getActiveDocumentSlots = (
	profile: Partial<Profile>,
): RequiredDocumentSlot[] => {
	const baseIds = ["id_card", "health_insurance", "pension_notice", "stmt3"];

	if (profile.health?.hasInpatientFacilityAccommodation !== true) {
		baseIds.push("rent", "heating");
	}

	if (profile.health?.isCareDependent === true) {
		baseIds.push("care_level_notice");
	}

	if (profile.health?.hasInpatientFacilityAccommodation === true) {
		baseIds.push("care_home_contract", "care_facility_costs");
	} else if (profile.health?.isCareDependent === true) {
		baseIds.push("care_service_invoice");
	}

	if (
		profile.health?.abilityToWork === "Permanently disabled" ||
		profile.health?.abilityToWork === "Temporarily disabled"
	) {
		baseIds.push("disability_id");
	}

	return REQUIRED_DOCUMENT_SLOTS.filter((slot) => baseIds.includes(slot.id));
};

/**
 * Computes the 3-tier progress signal (Level 0 to Level 3) based on exact mathematical ratios
 * of mandatory (Rm) and optional (Ro) completion parameters.
 */
export const calculateCompletenessIndicatorLevel = (
	profile: Partial<Profile>,
	documents: WalletDocument[],
): MilestoneLevel => {
	const coreSections = getMappedInformationSections(profile);
	const skipped = getActiveSkippedCategories(profile);
	const activeSections = coreSections.filter((s) => !skipped.includes(s.id));
	const filledSectionsCount = activeSections.filter((s) => s.completed).length;

	const activeSlots = getActiveDocumentSlots(profile);
	const processedDocsCount = activeSlots.filter((slot) => {
		const matched = documents.find((d) => doesDocumentMatchSlot(d, slot));
		return matched?.status === "VERIFIED";
	}).length;

	const mandatoryFilled = filledSectionsCount + processedDocsCount;
	const mandatoryTotal = activeSections.length + activeSlots.length;

	if (mandatoryFilled === 0) {
		return 0;
	}

	const rm = (mandatoryFilled / mandatoryTotal) * 100;

	if (rm <= 29) {
		return 1;
	}

	if (rm === 100) {
		return MAX_MILESTONE_LEVEL;
	}

	return 2;
};

/**
 * Centralized document-to-slot matching logic used across frontend components.
 */
const matchByType = (docType: string, slotId: string): boolean => {
	if (docType === slotId) {
		return true;
	}
	return (
		(slotId === "id_card" &&
			(docType === "id_card" ||
				docType === "passport" ||
				docType === "identity_document")) ||
		(slotId === "rent" && docType === "rental_contract") ||
		(slotId === "pension_notice" &&
			(docType === "pension_statement" || docType === "pension_notice")) ||
		(slotId === "stmt3" &&
			(docType === "bank_statement" || docType === "bank_statements")) ||
		(slotId === "heating" &&
			(docType === "heating_bill" || docType === "heating_costs_proof")) ||
		(slotId === "health_insurance" &&
			(docType === "health_insurance" || docType === "health_insurance_proof"))
	);
};

const matchByName = (cleanName: string, cleanTitle: string): boolean => {
	return !!cleanName && cleanName.includes(cleanTitle);
};

const matchByKeyword = (slotId: string, cleanName: string): boolean => {
	if (!cleanName) {
		return false;
	}
	switch (slotId) {
		case "id_card":
			return (
				cleanName.includes("personalausweis") ||
				cleanName.includes("reisepass") ||
				cleanName.includes("passport")
			);
		case "rent":
			return cleanName.includes("mietvertrag");
		case "pension_notice":
			return cleanName.includes("rente");
		case "stmt3":
			return cleanName.includes("konto");
		case "heating":
			return cleanName.includes("heizkosten") || cleanName.includes("heizen");
		case "care_level_notice":
			return cleanName.includes("pflege") || cleanName.includes("grad");
		case "care_home_contract":
			return cleanName.includes("heimvertrag");
		case "care_facility_costs":
			return cleanName.includes("heimkosten");
		case "care_service_invoice":
			return (
				cleanName.includes("ambulante") || cleanName.includes("pflegedienst")
			);
		case "disability_id":
			return (
				cleanName.includes("schwerbehindert") || cleanName.includes("ausweis")
			);
		default:
			return false;
	}
};

export const doesDocumentMatchSlot = (
	d: WalletDocument,
	slot: { id: string; defaultTitle: string },
): boolean => {
	const docTypeLower = d.type?.toLowerCase() || "";
	const slotIdLower = slot.id.toLowerCase();
	const cleanName = d.name ? sanitizeFileName(d.name).toLowerCase() : "";
	const cleanTitle = slot.defaultTitle.toLowerCase();

	return (
		matchByType(docTypeLower, slotIdLower) ||
		matchByName(cleanName, cleanTitle) ||
		matchByKeyword(slotIdLower, cleanName) ||
		docTypeLower.includes(slotIdLower)
	);
};

/**
 * Sanitizes extremely long filenames (e.g. stripping leading UUID prefix)
 * to prevent UI overflow and maintain clean layout.
 */
export const sanitizeFileName = (name: string): string => {
	return name.replace(
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i,
		"",
	);
};

const TYPE_MAPPING: Record<string, string> = {
	identity_document: "id_card",
	id_card: "id_card",
	passport: "id_card",
	bank_statements: "stmt3",
	bank_statement: "stmt3",
	stmt3: "stmt3",
	pension_notice: "pension_notice",
	pension_statement: "pension_notice",
	rental_contract: "rent",
	rent: "rent",
	heating_costs_proof: "heating",
	heating_bill: "heating",
	heating: "heating",
	bank_details: "bank",
	bank: "bank",
	utility_cost_statement: "utility_bill",
	utility_bill: "utility_bill",
	health_insurance: "health_insurance",
	health_insurance_proof: "health_insurance",
	care_level_notice: "care_level_notice",
	care_home_contract: "care_home_contract",
	care_facility_costs: "care_facility_costs",
	care_service_invoice: "care_service_invoice",
	disability_id: "disability_id",
};

/**
 * Maps database/backend document_type values into frontend REQUIRED_DOCUMENT_SLOTS IDs.
 */
export const mapBackendDocTypeToSlotId = (
	backendType: string | null | undefined,
): string => {
	if (!backendType) {
		return "OTHER";
	}
	const lower = String(backendType).toLowerCase();
	if (TYPE_MAPPING[lower]) {
		return TYPE_MAPPING[lower];
	}

	const VALID_SLOT_IDS = [
		"id_card",
		"registration",
		"health_insurance",
		"pension_notice",
		"stmt3",
		"income",
		"assets",
		"bank",
		"rent",
		"utility_bill",
		"heating",
		"housing",
		"cooperation_agreement",
		"household",
		"care_level_notice",
		"care_home_contract",
		"care_facility_costs",
		"care_service_invoice",
		"disability_id",
	];
	return VALID_SLOT_IDS.includes(lower) ? lower : "OTHER";
};

export const getTargetExitRoute = (
	origin: string | null,
	category: string | null,
	stage: "upload" | "review_success",
): string => {
	if (origin === "wizard") {
		if (category === "about_me") {
			return stage === "review_success"
				? AppRoutes.ApplicationAboutMeQuestions
				: AppRoutes.ApplicationAboutMeIntro;
		}
		if (category === "housing") {
			return stage === "review_success"
				? AppRoutes.ApplicationHousingQuestions
				: AppRoutes.ApplicationHousingIntro;
		}
		if (category === "income_assets") {
			return stage === "review_success"
				? AppRoutes.ApplicationIncomeAssetsQuestions
				: AppRoutes.ApplicationIncomeAssetsIntro;
		}
		if (category === "health") {
			return stage === "review_success"
				? AppRoutes.ApplicationHealthQuestions
				: AppRoutes.ApplicationHealthIntro;
		}
		return AppRoutes.ApplicationOverview;
	}
	if (category) {
		return AppRoutes.ProfileDocumentsCategory.replace(":categoryId", category);
	}
	return AppRoutes.ProfileDocuments;
};

export const parseAddressString = (addressStr: string) => {
	const result = {
		street: "",
		houseNumber: "",
		zipCode: "",
		city: "",
	};

	if (!addressStr) {
		return result;
	}

	const cleanStr = addressStr.trim();

	if (cleanStr.includes(",")) {
		const parts = cleanStr.split(",");
		const streetPart = parts[0].trim();
		const cityPart = (parts[1] || "").trim();

		const streetMatch = streetPart.match(/^(.*?)\s*(\d+\s*[a-zA-Z]?|\d+)?$/);
		if (streetMatch) {
			result.street = streetMatch[1].trim();
			result.houseNumber = (streetMatch[2] || "").trim();
		} else {
			result.street = streetPart;
		}

		const cityMatch = cityPart.match(/^(\d{5})\s+(.*)$/);
		if (cityMatch) {
			result.zipCode = cityMatch[1].trim();
			result.city = cityMatch[2].trim();
		} else {
			result.city = cityPart;
		}
	} else {
		const zipMatch = cleanStr.match(/^(.*?)\s+(\d{5})\s+(.*)$/);
		if (zipMatch) {
			const streetPart = zipMatch[1].trim();
			result.zipCode = zipMatch[2].trim();
			result.city = zipMatch[3].trim();

			const streetMatch = streetPart.match(/^(.*?)\s*(\d+\s*[a-zA-Z]?|\d+)?$/);
			if (streetMatch) {
				result.street = streetMatch[1].trim();
				result.houseNumber = (streetMatch[2] || "").trim();
			} else {
				result.street = streetPart;
			}
		} else {
			result.street = cleanStr;
		}
	}

	return result;
};

/**
 * Returns the localStorage key used to store the mock profile data.
 */
export function getMockProfileStorageKey(phoneNumber?: string): string {
	const suffix = phoneNumber || "default";
	return `beyond-forms-mock-profile-${suffix}`;
}

/**
 * Executes a mock auto-verification flow for a specific document and updates the profile data.
 * Used consistently across components and hooks in mock environments.
 */
export function performMockAutoVerification(
	profile: Profile,
	doc: WalletDocument,
): { updatedProfile: Profile; hasChanges: boolean } {
	const fileName = doc.name || "";
	const lastDotIndex = fileName.lastIndexOf(".");
	const fileNameWithoutExt =
		lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
	const nameParts = fileNameWithoutExt.split(/[-_\s]+/);
	const lowercaseParts = nameParts.map((p) => p.toLowerCase());

	let mockFirstName = "Helmut";
	let mockLastName = "Klar";

	if (lowercaseParts.includes("helmut") || lowercaseParts.includes("klar")) {
		mockFirstName = "Helmut";
		mockLastName = "Klar";
	} else {
		const filteredParts = nameParts.filter(
			(p) =>
				![
					"kontoauszug",
					"auszug",
					"kontoauszüge",
					"statement",
					"bank",
					"personalausweis",
					"ausweis",
					"scan",
					"id",
					"card",
					"pdf",
					"png",
					"jpg",
					"jpeg",
					"mietvertrag",
					"rentenbescheid",
					"heizkostenabrechnung",
					"versicherungsbescheinigung",
					"beispiel",
					"nachweis",
					"hello",
					"test",
					"document",
					"copy",
					"file",
					"image",
				].includes(p.toLowerCase()) && p.length > 0,
		);
		if (filteredParts.length >= 1) {
			const capitalize = (s: string) =>
				s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
			mockFirstName = capitalize(filteredParts[0]);
			if (filteredParts.length >= 2) {
				mockLastName = capitalize(filteredParts[1]);
			}
		}
	}

	const updatedProfile = { ...profile };
	let hasChanges = false;

	const lowerType = (doc.type || "").toLowerCase();
	// Dynamic document type classification in mock mode if type is not specified or is OTHER
	const isBankDoc =
		lowerType === "stmt3" ||
		lowerType === "bank" ||
		(lowerType === "other" &&
			(fileName.toLowerCase().includes("bank") ||
				fileName.toLowerCase().includes("statement") ||
				fileName.toLowerCase().includes("kontoauszug") ||
				fileName.toLowerCase().includes("auszug") ||
				fileName.toLowerCase().includes("kontoauszüge")));

	const isIdCard =
		lowerType === "id_card" ||
		(lowerType === "other" &&
			(fileName.toLowerCase().includes("ausweis") ||
				fileName.toLowerCase().includes("id_card") ||
				fileName.toLowerCase().includes("passport") ||
				fileName.toLowerCase().includes("personalausweis")));

	const isRentDoc =
		lowerType === "rent" ||
		lowerType === "rental_contract" ||
		(lowerType === "other" &&
			(fileName.toLowerCase().includes("mietvertrag") ||
				fileName.toLowerCase().includes("rent") ||
				fileName.toLowerCase().includes("lease")));

	const isHeatingDoc =
		lowerType === "heating" ||
		lowerType === "heating_bill" ||
		(lowerType === "other" &&
			(fileName.toLowerCase().includes("heizkosten") ||
				fileName.toLowerCase().includes("heating")));

	if (isIdCard) {
		doc.type = "id_card";
		updatedProfile.personalData = {
			...profile.personalData,
			firstName: mockFirstName,
			lastName: mockLastName,
			dateOfBirth: "1959-05-12",
			placeOfBirth: "Berlin",
			legalGender: "Male",
			isGermanCitizen: true,
			nationality: "DE",
			hasCustodian: false,
			hasGuardian: false,
			displacedStatus: null,
			socialSecurityType: "None",
			healthInsuranceStatus: "Compulsory Insurance",
			hasAppliedForAsylumBenefits: false,
		};
		hasChanges = true;
	} else if (isBankDoc) {
		doc.type = "bank";
		let bankName = "Sparkasse Musterstadt";
		if (fileName.toLowerCase().includes("commerzbank")) {
			bankName = "Commerzbank";
		} else if (fileName.toLowerCase().includes("deutsche")) {
			bankName = "Deutsche Bank";
		}

		updatedProfile.financial = {
			...profile.financial,
			bankDetails: {
				bankName,
				accountHolder: `${mockFirstName} ${mockLastName}`,
				iban: "DE65940594210000123456",
				bic: "WELADED1BER",
			},
			monthlyIncome: 650,
			incomeSources: Array.from(
				new Set([
					...(profile.financial?.incomeSources || []),
					"pension",
					"pension_retirement",
				]),
			),
		};

		updatedProfile.address = {
			...profile.address,
			street: "Platz der Luftbrücke",
			houseNumber: "4",
			zipCode: "12101",
			city: "Berlin",
		};

		updatedProfile.personalData = {
			...profile.personalData,
			firstName: mockFirstName,
			lastName: mockLastName,
		};
		hasChanges = true;
	} else if (isRentDoc) {
		doc.type = "rent";
		updatedProfile.housing = {
			...profile.housing,
			accomodationType: "Rental Apartment",
			tenancyStatus: "Main Tenant",
			rentTotal: 430,
			heatingCosts: 80,
			livingArea: 50,
			numberOfRooms: 2,
			landlordName: "Muster Vermieter",
			cableTvCosts: 10,
			hotWaterCosts: 20,
		};
		hasChanges = true;
	} else if (isHeatingDoc) {
		doc.type = "heating";
		updatedProfile.housing = {
			...profile.housing,
			heatingCosts: 80,
			heatingType: "Sammelheizung",
		};
		hasChanges = true;
	}

	return { updatedProfile, hasChanges };
}
