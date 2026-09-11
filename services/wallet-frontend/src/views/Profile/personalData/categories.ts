import type { FC } from "react";
import type { SectionProps } from "./types";
import {
	IdentitySection,
	StatusSection,
	AddressSection,
	ContactSection,
	VehicleSection,
	InsuranceSection,
	HouseholdSection,
	HousingSection,
	FinancialSection,
	HealthSection,
} from "./sections";

export interface ProfileCategory {
	id: string;
	labelKey: string;
	labelFallback: string;
	Section: FC<SectionProps>;
	completionFields: string[];
}

export const PROFILE_CATEGORIES: ProfileCategory[] = [
	{
		id: "identity",
		labelKey: "personal.groups.identity",
		labelFallback: "Rechtliche Identität",
		Section: IdentitySection,
		completionFields: [
			"legalGender",
			"firstName",
			"lastName",
			"dateOfBirth",
			"placeOfBirth",
		],
	},
	{
		id: "status",
		labelKey: "personal.groups.status",
		labelFallback: "Staatsangehörigkeit und Status",
		Section: StatusSection,
		completionFields: [
			"nationality",
			"residenceStatus",
			"maritalStatus",
			"identificationNumbers",
			"taxId",
		],
	},
	{
		id: "contact",
		labelKey: "personal.groups.contact",
		labelFallback: "Kontakt",
		Section: ContactSection,
		completionFields: ["email", "phoneNumber"],
	},
	{
		id: "address",
		labelKey: "personal.groups.address",
		labelFallback: "Meldeadresse",
		Section: AddressSection,
		completionFields: ["street", "houseNumber", "zipCode", "city", "state"],
	},
	{
		id: "vehicle",
		labelKey: "personal.groups.vehicle",
		labelFallback: "Fahrzeug",
		Section: VehicleSection,
		completionFields: ["licensePlate"],
	},
	{
		id: "insurance",
		labelKey: "personal.groups.insurance",
		labelFallback: "Versicherung und Erwerbstätigkeit",
		Section: InsuranceSection,
		completionFields: [
			"socialSecurityType",
			"healthInsuranceStatus",
			"healthInsuranceProvider",
			"pensionInsuranceProvider",
			"pensionInsuranceNo",
		],
	},
	{
		id: "household",
		labelKey: "personal.groups.household",
		labelFallback: "Haushalt",
		Section: HouseholdSection,
		completionFields: ["personsInHouseholdCount"],
	},
	{
		id: "housing",
		labelKey: "personal.groups.housing",
		labelFallback: "Wohnsituation",
		Section: HousingSection,
		completionFields: [
			"accomodationType",
			"tenancyStatus",
			"rentTotal",
			"heatingCosts",
			"livingArea",
			"numberOfRooms",
			"landlordName",
			"heatingType",
		],
	},
	{
		id: "financial",
		labelKey: "personal.groups.financial",
		labelFallback: "Einkommen und Vermögen",
		Section: FinancialSection,
		completionFields: [
			"monthlyIncome",
			"incomeSources",
			"bankName",
			"accountHolder",
			"iban",
		],
	},
	{
		id: "health",
		labelKey: "personal.groups.health",
		labelFallback: "Gesundheit und Pflege",
		Section: HealthSection,
		completionFields: ["abilityToWork"],
	},
];

/** Mirrors the vocabulary ProfileSectionCard already uses for its status dot. */
export type CategoryStatus = "MISSING" | "PARTIAL" | "COMPLETE";

export function isFieldFilled(value: unknown): boolean {
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (typeof value === "string") {
		return value.trim().length > 0;
	}
	if (typeof value === "number") {
		return !Number.isNaN(value);
	}
	return value !== undefined && value !== null;
}

export function getCategoryStatuses(
	values: Record<string, unknown>,
): Record<string, CategoryStatus> {
	const statuses: Record<string, CategoryStatus> = {};

	for (const category of PROFILE_CATEGORIES) {
		const filledCount = category.completionFields.filter((field) =>
			isFieldFilled(values[field]),
		).length;

		if (filledCount === category.completionFields.length) {
			statuses[category.id] = "COMPLETE";
		} else if (filledCount > 0) {
			statuses[category.id] = "PARTIAL";
		} else {
			statuses[category.id] = "MISSING";
		}
	}

	return statuses;
}
