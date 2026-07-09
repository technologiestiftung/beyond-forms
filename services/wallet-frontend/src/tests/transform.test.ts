import { describe, it, expect } from "vitest";
import {
	mapPersonalDataToFrontend,
	mapBackendKeyToFrontendKey,
	toCamelCase,
	toSnakeCase,
	mapProfileToFrontend,
	mapProfileToBackend,
} from "../utils/transform";
import type { Profile } from "../schemas/profile.schema";

describe("Profile Transformation Utilities", () => {
	describe("Generic Mappers", () => {
		it("toCamelCase handles nested objects and arrays", () => {
			const input = {
				first_name: "John",
				address_info: {
					street_name: "Main St",
					zip_codes: [12345, 67890],
				},
				tags_list: [
					{ tag_id: 1, tag_name: "urgent" },
					{ tag_id: 2, tag_name: "low" },
				],
			};
			const expected = {
				firstName: "John",
				addressInfo: {
					streetName: "Main St",
					zipCodes: [12345, 67890],
				},
				tagsList: [
					{ tagId: 1, tagName: "urgent" },
					{ tagId: 2, tagName: "low" },
				],
			};
			expect(toCamelCase(input)).toEqual(expected);
		});

		it("toSnakeCase handles nested objects and arrays", () => {
			const input = {
				firstName: "John",
				addressInfo: {
					streetName: "Main St",
					zipCodes: [12345, 67890],
				},
			};
			const expected = {
				first_name: "John",
				address_info: {
					street_name: "Main St",
					zip_codes: [12345, 67890],
				},
			};
			expect(toSnakeCase(input)).toEqual(expected);
		});
	});

	describe("mapPersonalDataToFrontend", () => {
		it("correctly maps valid backend data to frontend format", () => {
			const backendData = {
				first_name: "Helmut",
				last_name: "Klar",
				date_of_birth: "1990-01-01",
				place_of_birth: "Berlin",
				legal_gender: "Female",
			};

			const result = mapPersonalDataToFrontend(backendData);

			expect(result).toEqual({
				firstName: "Helmut",
				lastName: "Klar",
				dateOfBirth: "1990-01-01",
				placeOfBirth: "Berlin",
				legalGender: "Female",
			});
		});

		it("throws error for invalid legal_gender (Strict Validation)", () => {
			const backendData = {
				first_name: "Unknown",
				last_name: "User",
				date_of_birth: "2000-01-01",
				place_of_birth: "Munich",
				legal_gender: "INVALID_GENDER",
			};

			expect(() => mapPersonalDataToFrontend(backendData)).toThrow();
		});
	});

	describe("mapBackendKeyToFrontendKey", () => {
		it("correctly maps snake_case keys to camelCase keys", () => {
			expect(mapBackendKeyToFrontendKey("first_name")).toBe("firstName");
			expect(mapBackendKeyToFrontendKey("last_name")).toBe("lastName");
			expect(mapBackendKeyToFrontendKey("date_of_birth")).toBe("dateOfBirth");
			expect(mapBackendKeyToFrontendKey("place_of_birth")).toBe("placeOfBirth");
			expect(mapBackendKeyToFrontendKey("legal_gender")).toBe("legalGender");
		});
	});

	describe("mapProfileToFrontend", () => {
		it("correctly maps a full profile", () => {
			const backendProfile = {
				personal_data: {
					first_name: "Sandor",
					last_name: "Klaro",
					date_of_birth: "1955-05-15",
					place_of_birth: "Berlin",
					legal_gender: "Male",
				},
				address: { street: "Main", zip_code: "12345", city: "Berlin" },
				contact: { email: "s@example.com" },
				financial: {
					bank_details: {
						bank_name: "Sparkasse",
						account_holder: "Sandor",
						iban: "DE89370400441234567890",
					},
					monthly_income: 1000,
					has_assets: false,
				},
				household: {
					persons_in_household_count: 1,
					marital_status: "Single",
				},
				housing: {
					accomodation_type: "Rental Apartment",
					tenancy_status: "Main Tenant",
					rent_total: 500,
					heating_costs: 80,
					living_area: 45,
					number_of_rooms: 2,
				},
				health: {
					has_disability_id: true,
					has_costly_medical_nutrition: false,
				},
				documents: [],
				settings: {
					language: "de",
					notifications_enabled: true,
					persona_address: "Formal",
				},
			};

			const result = mapProfileToFrontend(backendProfile);
			expect(result.personalData.firstName).toBe("Sandor");
			expect(result.financial.bankDetails.bankName).toBe("Sparkasse");
		});

		it("correctly maps a flat backend profile to nested structure", () => {
			const flatBackendProfile = {
				first_name: "Kenny",
				last_name: "Coder",
				date_of_birth: "1990-12-12",
				place_of_birth: "FR",
				legal_gender: "Male",
				phone_number: "+4930231256969",
				bank_name: "MyBank",
				account_holder: "Kenny Coder",
				iban: "DE89370400441234567890",
				bic: "BANKDEBBXXX",
				birth_name: "Birth Coder",
				residence_status: "Citizen",
				identification_numbers: "ID123",
				tax_id: "TAX123",
				street: "Main St",
				house_number: "10",
				zip_code: "12345",
				city: "Berlin",
				state: "Berlin",
				persons_in_household_count: 1,
				marital_status: "Single",
				accomodation_type: "Rental Apartment",
				tenancy_status: "Main Tenant",
				rent_total: 500,
				heating_costs: 80,
				living_area: 45,
				number_of_rooms: 2,
				has_disability_id: true,
				has_costly_medical_nutrition: false,
				is_german_citizen: true,
				has_applied_for_benefits_awaiting_decision: true,
				benefits_awaiting_decision_type: "Pension",
				benefits_awaiting_decision_application_date: "2026-06-01",
				benefits_awaiting_decision_office: "Sozialamt",
				benefits_awaiting_decision_reference: "REF123",
				are_one_time_payments_expected: true,
				one_time_payments_expected_type: "Inheritance",
				one_time_payments_expected_amount: 5000,
				one_time_payments_expected_date: "2026-08-01",
				has_received_previous_benefits: true,
				previous_benefits_period: "2020-01-01 to 2020-06-01",
				previous_benefits_authority: "Sozialamt",
				previous_benefits_ref_no: "REF456",
				is_currently_employed: true,
			};

			const result = mapProfileToFrontend(flatBackendProfile);

			expect(result.personalData.firstName).toBe("Kenny");
			expect(result.personalData.lastName).toBe("Coder");
			expect(result.personalData.birthName).toBe("Birth Coder");
			expect(result.personalData.residenceStatus).toBe("Citizen");
			expect(result.personalData.isGermanCitizen).toBe(true);
			expect(result.personalData.identificationNumbers).toBe("ID123");
			expect(result.personalData.taxId).toBe("TAX123");
			expect(result.personalData.hasReceivedPreviousBenefits).toBe(true);
			expect(result.personalData.previousBenefitsPeriod).toBe(
				"2020-01-01 to 2020-06-01",
			);
			expect(result.personalData.previousBenefitsAuthority).toBe("Sozialamt");
			expect(result.personalData.previousBenefitsRefNo).toBe("REF456");
			expect(result.personalData.isCurrentlyEmployed).toBe(true);
			expect(result.address.street).toBe("Main St");
			expect(result.address.houseNumber).toBe("10");
			expect(result.address.zipCode).toBe("12345");
			expect(result.address.city).toBe("Berlin");
			expect(result.address.state).toBe("Berlin");
			expect(result.contact.phoneNumber).toBe("+4930231256969");
			expect(result.financial.bankDetails.bankName).toBe("MyBank");
			expect(result.financial.bankDetails.bic).toBe("BANKDEBBXXX");
			expect(result.financial.hasAppliedForBenefitsAwaitingDecision).toBe(true);
			expect(result.financial.benefitsAwaitingDecisionType).toBe("Pension");
			expect(result.financial.benefitsAwaitingDecisionApplicationDate).toBe(
				"2026-06-01",
			);
			expect(result.financial.benefitsAwaitingDecisionOffice).toBe("Sozialamt");
			expect(result.financial.benefitsAwaitingDecisionReference).toBe("REF123");
			expect(result.financial.areOneTimePaymentsExpected).toBe(true);
			expect(result.financial.oneTimePaymentsExpectedType).toBe("Inheritance");
			expect(result.financial.oneTimePaymentsExpectedAmount).toBe(5000);
			expect(result.financial.oneTimePaymentsExpectedDate).toBe("2026-08-01");
		});

		it("maps backend has_guardian, has_custodian, displaced_status, and insurances to frontend personalData", () => {
			const backendProfile = {
				has_guardian: true,
				has_custodian: false,
				displaced_status: "Late Resettler",
				social_security_type: "Pension Insurance",
				health_insurance_status: null,
			};
			const result = mapProfileToFrontend(backendProfile);
			expect(result.personalData.hasGuardian).toBe(true);
			expect(result.personalData.hasCustodian).toBe(false);
			expect(result.personalData.displacedStatus).toBe("Late Resettler");
			expect(result.personalData.socialSecurityType).toBe("Pension Insurance");
			expect(result.personalData.healthInsuranceStatus).toBeUndefined();
		});
	});

	describe("mapProfileToBackend", () => {
		it("flattens a full profile and converts keys to snake_case", () => {
			const profile = {
				personalData: {
					firstName: "Kenny",
					lastName: "Coder",
					dateOfBirth: "1990-12-12",
					placeOfBirth: "FR",
					legalGender: "Male",
					maritalStatus: "Registered Civil Partnership",
					birthName: "Birth Coder",
					residenceStatus: "Citizen",
					identificationNumbers: "ID123",
					taxId: "TAX123",
					hasReceivedPreviousBenefits: true,
					previousBenefitsPeriod: "2020-01-01 to 2020-06-01",
					previousBenefitsAuthority: "Sozialamt",
					previousBenefitsRefNo: "REF456",
				},
				address: {
					street: "Main",
					zipCode: "12345",
					city: "Berlin",
					state: "Berlin",
				},
				contact: { email: "k@example.com", phoneNumber: "+49123" },
				financial: {
					bankDetails: {
						bankName: "Sparkasse",
						accountHolder: "Kenny",
						iban: "DE89370400441234567890",
						bic: "BANKDEBBXXX",
					},
					monthlyIncome: 1000,
					hasAssets: false,
					hasAppliedForBenefitsAwaitingDecision: true,
					benefitsAwaitingDecisionType: "Pension",
					benefitsAwaitingDecisionApplicationDate: "2026-06-01",
					benefitsAwaitingDecisionOffice: "Sozialamt",
					benefitsAwaitingDecisionReference: "REF123",
					areOneTimePaymentsExpected: true,
					oneTimePaymentsExpectedType: "Inheritance",
					oneTimePaymentsExpectedAmount: 5000,
					oneTimePaymentsExpectedDate: "2026-08-01",
				},
				household: {
					personsInHouseholdCount: 1,
					maritalStatus: "Registered Civil Partnership",
				},
				housing: {
					accomodationType: "Rental Apartment",
					tenancyStatus: "Main Tenant",
					rentTotal: 500,
					heatingCosts: 80,
					livingArea: 45,
					numberOfRooms: 2,
				},
				health: {
					hasDisabilityId: true,
					hasCostlyMedicalNutrition: false,
				},
				documents: [],
				settings: {
					language: "de",
					notificationsEnabled: true,
					personaAddress: "Formal",
				},
			};

			const result = mapProfileToBackend(profile as Profile);

			expect(result.first_name).toBe("Kenny");
			expect(result.marital_status).toBe("Registered Civil Partnership");
			expect(result.street).toBe("Main");
			expect(result.state).toBe("Berlin");
			expect(result.birth_name).toBe("Birth Coder");
			expect(result.residence_status).toBe("Citizen");
			expect(result.identification_numbers).toBe("ID123");
			expect(result.tax_id).toBe("TAX123");
			expect(result.has_received_previous_benefits).toBe(true);
			expect(result.previous_benefits_period).toBe("2020-01-01 to 2020-06-01");
			expect(result.previous_benefits_authority).toBe("Sozialamt");
			expect(result.previous_benefits_ref_no).toBe("REF456");
			expect(result.bank_name).toBe("Sparkasse");
			expect(result.bic).toBe("BANKDEBBXXX");
			expect(result.has_applied_for_benefits_awaiting_decision).toBe(true);
			expect(result.benefits_awaiting_decision_type).toBe("Pension");
			expect(result.benefits_awaiting_decision_application_date).toBe(
				"2026-06-01",
			);
			expect(result.benefits_awaiting_decision_office).toBe("Sozialamt");
			expect(result.benefits_awaiting_decision_reference).toBe("REF123");
			expect(result.are_one_time_payments_expected).toBe(true);
			expect(result.one_time_payments_expected_type).toBe("Inheritance");
			expect(result.one_time_payments_expected_amount).toBe(5000);
			expect(result.one_time_payments_expected_date).toBe("2026-08-01");
			expect(result.bank_details).toBeUndefined(); // Should be flattened
		});

		it("preserves maritalStatus when household status is undefined", () => {
			const profile = {
				personalData: {
					firstName: "Kenny",
					lastName: "Coder",
					maritalStatus: "Single",
				},
				household: {
					maritalStatus: undefined,
				},
			};

			const result = mapProfileToBackend(profile as unknown as Profile);
			expect(result.marital_status).toBe("Single");
		});

		it("maps frontend guardian, custodian, displacedStatus, and insurances to backend flat keys", () => {
			const profile = {
				personalData: {
					hasGuardian: false,
					hasCustodian: true,
					displacedStatus: "Soviet Zone Refugee",
					socialSecurityType: "None",
					healthInsuranceStatus: "Private Insurance",
				},
			};
			const result = mapProfileToBackend(profile as unknown as Profile);
			expect(result.has_guardian).toBe(false);
			expect(result.has_custodian).toBe(true);
			expect(result.displaced_status).toBe("Soviet Zone Refugee");
			expect(result.social_security_type).toBe("None");
			expect(result.health_insurance_status).toBe("Private Insurance");
		});
	});
});
