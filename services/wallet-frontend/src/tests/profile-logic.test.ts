import { describe, it, expect } from "vitest";
import {
	calculateCompletionPercentage,
	getMappedInformationSections,
	calculateCompletenessIndicatorLevel,
	doesDocumentMatchSlot,
} from "../utils/profile";
import type {
	WalletDocument,
	DocumentType,
	Profile,
} from "../schemas/profile.schema";
describe("Profile Logic: Completion Percentage", () => {
	it("starts at 0% completion", () => {
		expect(calculateCompletionPercentage({})).toBe(0);
	});

	it("awards 25% for completed about_me category", () => {
		const result = calculateCompletionPercentage({
			personalData: {
				firstName: "Helmut",
				lastName: "Klar",
				dateOfBirth: "1990-01-01",
				placeOfBirth: "Berlin",
				legalGender: "Female",
				isGermanCitizen: true,
				nationality: "DE",
				hasCustodian: false,
				hasGuardian: false,
				displacedStatus: null,
				socialSecurityType: "None",
				healthInsuranceStatus: null,
			},
			address: {
				street: "Hauptstr",
				houseNumber: "10",
				city: "Berlin",
				zipCode: "10115",
			},
		});

		expect(result).toBe(20);
	});

	it("does NOT award 20% for incomplete about_me category", () => {
		const result = calculateCompletionPercentage({
			personalData: {
				firstName: "Helmut",
				lastName: "",
				dateOfBirth: "",
				placeOfBirth: "",
				legalGender: "Female",
			},
		});

		expect(result).toBe(0);
	});

	it("does NOT award progress for skipped household category", () => {
		const result = calculateCompletionPercentage({
			household: {
				maritalStatus: "Single",
			},
		});

		expect(result).toBe(0);
	});

	it("awards 25% for completed housing category", () => {
		const result = calculateCompletionPercentage({
			address: {
				street: "Hauptstr",
				houseNumber: "10",
				city: "Berlin",
				zipCode: "10115",
			},
			housing: {
				accomodationType: "Rental Apartment",
				tenancyStatus: "Main Tenant",
				rentTotal: 430,
				heatingCosts: 80,
				livingArea: 50,
				numberOfRooms: 2,
				heatingType: "Sammelheizung",
				subletRoomCount: 0,
				rentPaidUntil: "2026-06-30",
			},
		});

		expect(result).toBe(20);
	});

	it("awards 25% for completed income_assets category", () => {
		const result = calculateCompletionPercentage({
			personalData: {
				firstName: "Helmut",
				lastName: "Klar",
				dateOfBirth: "1990-01-01",
				placeOfBirth: "Berlin",
				legalGender: "Female",
				hasReceivedPreviousBenefits: false,
				isCurrentlyEmployed: false,
			},
			financial: {
				hasAppliedForBenefitsAwaitingDecision: false,
				incomeSources: ["none_pension", "none_other"],
				areOneTimePaymentsExpected: false,
				bankDetails: {
					bankName: "Sparkasse",
					accountHolder: "Helmut Klar",
					iban: "DE1234567890",
				},
			},
		});

		expect(result).toBe(20);
	});

	it("reaches 100% when all active sections are fully and meaningfully populated", () => {
		const result = calculateCompletionPercentage({
			personalData: {
				firstName: "Helmut",
				lastName: "Klar",
				dateOfBirth: "1990-01-01",
				placeOfBirth: "Berlin",
				legalGender: "Female",
				isGermanCitizen: true,
				nationality: "DE",
				hasCustodian: false,
				hasGuardian: false,
				displacedStatus: null,
				socialSecurityType: "None",
				healthInsuranceStatus: null,
				hasReceivedPreviousBenefits: false,
				isCurrentlyEmployed: false,
			},
			address: {
				street: "Hauptstr",
				houseNumber: "10",
				city: "Berlin",
				zipCode: "10115",
			},
			housing: {
				accomodationType: "Rental Apartment",
				tenancyStatus: "Main Tenant",
				rentTotal: 430,
				heatingCosts: 80,
				livingArea: 50,
				numberOfRooms: 2,
				heatingType: "Sammelheizung",
				subletRoomCount: 0,
				rentPaidUntil: "2026-06-30",
			},
			financial: {
				hasAppliedForBenefitsAwaitingDecision: false,
				incomeSources: ["none_pension", "none_other"],
				areOneTimePaymentsExpected: false,
				bankDetails: {
					bankName: "Sparkasse",
					accountHolder: "Helmut Klar",
					iban: "DE1234567890",
				},
			},
			health: {
				isCareDependent: false,
				abilityToWork: "Fully able",
				hasCostlyMedicalNutrition: false,
			},
			household: {
				personsInHouseholdCount: 1,
				maritalStatus: "Single",
			},
		});

		expect(result).toBe(100);
	});
});

describe("Profile Logic: Mapped Information Sections", () => {
	it("maps all 5 core sections correctly and computes finalized status dynamically", () => {
		const sections = getMappedInformationSections({
			personalData: {
				hasCustodian: false,
				displacedStatus: "none",
				socialSecurityType: "None",
			},
			household: {
				personsInHouseholdCount: 1,
				maritalStatus: "Single",
			},
			housing: {
				accomodationType: "Rental Apartment",
			},
		} as Partial<Profile>);

		expect(sections).toHaveLength(5);

		const household = sections.find((s) => s.id === "household");
		expect(household?.completed).toBe(true);

		const housing = sections.find((s) => s.id === "housing");
		expect(housing?.completed).toBe(true);

		const incomeAssets = sections.find((s) => s.id === "income_assets");
		expect(incomeAssets?.completed).toBe(false);
	});

	it("returns mapped sections in the correct order: about_me, income_assets, housing, health, household", () => {
		const sections = getMappedInformationSections({});
		expect(sections).toHaveLength(5);
		expect(sections[0].id).toBe("about_me");
		expect(sections[1].id).toBe("income_assets");
		expect(sections[2].id).toBe("housing");
		expect(sections[3].id).toBe("health");
		expect(sections[4].id).toBe("household");
	});
});

describe("Profile Logic: Completeness Indicator Level (3-Tier Progress Signal)", () => {
	it("returns Level 0 (Grey) when no mandatory information or documents are provided", () => {
		expect(calculateCompletenessIndicatorLevel({}, [])).toBe(0);
	});

	it("returns Level 1 (Weak Application / Red) when mandatory completion is between 0% and 29%", () => {
		// Providing only health status gives 1 out of 3 mandatory sections (33% of sections, but combined with docs is less than 30%)
		expect(
			calculateCompletenessIndicatorLevel(
				{
					housing: {
						accomodationType: "Rental Apartment",
					},
				},
				[],
			),
		).toBe(1);
	});

	it("returns Level 2 (Medium Application / Yellow) when mandatory completion is >= 30% but optional is < 50%", () => {
		// Fulfilling multiple mandatory sections but no optional items
		expect(
			calculateCompletenessIndicatorLevel(
				{
					personalData: {
						firstName: "Helmut",
						lastName: "Klar",
						dateOfBirth: "1959-01-01",
						placeOfBirth: "Berlin",
						legalGender: "Male",
						isGermanCitizen: true,
						nationality: "DE",
						hasCustodian: false,
						hasGuardian: false,
						displacedStatus: null,
						socialSecurityType: "None",
						healthInsuranceStatus: null,
						hasAppliedForAsylumBenefits: false,
					},
					address: {
						street: "Tempelhofer",
						houseNumber: "12",
						zipCode: "12099",
						city: "Berlin",
					},
					household: {
						personsInHouseholdCount: 1,
						maritalStatus: "Single",
					},
					housing: {
						accomodationType: "Rental Apartment",
					},
					financial: {
						incomeSources: ["pension"],
						hasAssets: false,
						monthlyIncome: 650,
						bankDetails: {
							iban: "DE1234567890",
						},
					},
					health: {
						hasDisabilityId: true,
					},
				},
				[
					{
						id: "1",
						type: "ID_CARD",
						name: "Personalausweis",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
				],
			),
		).toBe(2);
	});

	it("returns Level 3 (Strong Application / Green) when 100% mandatory + >= 50% optional fields are filled", () => {
		// Fulfilling all 5 core sections + all documents
		expect(
			calculateCompletenessIndicatorLevel(
				{
					personalData: {
						firstName: "Helmut",
						lastName: "Klar",
						dateOfBirth: "1959-01-01",
						placeOfBirth: "Berlin",
						legalGender: "Male",
						isGermanCitizen: true,
						nationality: "DE",
						hasCustodian: false,
						hasGuardian: false,
						displacedStatus: null,
						socialSecurityType: "None",
						healthInsuranceStatus: null,
						hasReceivedPreviousBenefits: false,
						isCurrentlyEmployed: false,
					},
					address: {
						street: "Tempelhofer",
						houseNumber: "12",
						zipCode: "12099",
						city: "Berlin",
					},
					household: {
						personsInHouseholdCount: 1,
						maritalStatus: "Single",
					},
					housing: {
						accomodationType: "Rental Apartment",
					},
					financial: {
						hasAppliedForBenefitsAwaitingDecision: false,
						incomeSources: ["pension", "none_other"],
						areOneTimePaymentsExpected: false,
						bankDetails: {
							iban: "DE1234567890",
							accountHolder: "Helmut Klar",
						},
					},
					health: {
						isCareDependent: false,
						abilityToWork: "Fully able",
						hasCostlyMedicalNutrition: false,
					},
					contact: {
						phoneNumber: "030123456",
					},
				},
				[
					{
						id: "1",
						type: "ID_CARD",
						name: "Personalausweis oder Reisepass",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "2",
						type: "OTHER",
						name: "Meldebescheinigung",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "3",
						type: "OTHER",
						name: "Nachweis der Krankenversicherungsmitgliedschaft",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "4",
						type: "OTHER",
						name: "Erstrentenbescheid",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "5",
						type: "OTHER",
						name: "Kontoauszüge der letzten 3 Monate",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "6",
						type: "OTHER",
						name: "Mietvertrag",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "7",
						type: "OTHER",
						name: "Nebenkostenrechnung Deiner Wohnung",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "8",
						type: "OTHER",
						name: "Heizkostennachweis (Gas-/Wärmerechnung)",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "9",
						type: "OTHER",
						name: "Einkommenserklärung (Anlage Einkommen)",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "10",
						type: "OTHER",
						name: "Anlage Vermögen",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "11",
						type: "OTHER",
						name: "Anlage Unterkunft / Kosten der Unterkunft",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "12",
						type: "OTHER",
						name: "Bankdaten",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "13",
						type: "OTHER",
						name: "Mitwirkungsverpflichtung + Datenschutzerklärung",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
					{
						id: "14",
						type: "OTHER",
						name: "Haushaltsangehörige/Bedarfsgemeinschaftserklärung",
						status: "VERIFIED",
						uploadDate: "2026-01-01",
					},
				],
			),
		).toBe(3);
	});
});

describe("Profile Logic: doesDocumentMatchSlot", () => {
	it("matches standard Zod uppercase enums (Backward Compatibility)", () => {
		const doc = {
			id: "doc-1",
			name: "any-name.pdf",
			type: "PENSION_STATEMENT" as const,
			status: "VERIFIED" as const,
			uploadDate: "2026-01-01",
		};
		const slot = { id: "pension_notice", defaultTitle: "Erstrentenbescheid" };
		expect(doesDocumentMatchSlot(doc, slot)).toBe(true);
	});

	it("matches lowercase snake_case slugs returned by DIS classification backend", () => {
		const doc = {
			id: "doc-1",
			name: "any-name.pdf",
			type: "identity_document" as unknown as DocumentType,
			status: "READY_FOR_REVIEW" as const,
			uploadDate: "2026-01-01",
		} as WalletDocument;
		const slot = {
			id: "id_card",
			defaultTitle: "Personalausweis oder Reisepass",
		};
		expect(doesDocumentMatchSlot(doc, slot)).toBe(true);
	});

	it("matches custom GCS object name containing UUID prefix by smart keyword", () => {
		const doc = {
			id: "doc-1",
			name: "a05c3df2-7a7d-4527-941d-ac222818c5bd_Personalausweis__Helmut_Klar.png",
			type: "tbd" as unknown as DocumentType,
			status: "READY_FOR_REVIEW" as const,
			uploadDate: "2026-01-01",
		} as WalletDocument;
		const slot = {
			id: "id_card",
			defaultTitle: "Personalausweis oder Reisepass",
		};
		expect(doesDocumentMatchSlot(doc, slot)).toBe(true);
	});

	it("matches German keyword fallback for Mietvertrag", () => {
		const doc = {
			id: "doc-1",
			name: "My_Mietvertrag_Final.pdf",
			type: "OTHER" as unknown as DocumentType,
			status: "READY_FOR_REVIEW" as const,
			uploadDate: "2026-01-01",
		} as WalletDocument;
		const slot = { id: "rent", defaultTitle: "Mietvertrag" };
		expect(doesDocumentMatchSlot(doc, slot)).toBe(true);
	});

	it("matches German keyword fallback for Rentenbescheid (even with spelling variations)", () => {
		const doc = {
			id: "doc-1",
			name: "pension_rentebescheid.pdf",
			type: "OTHER" as unknown as DocumentType,
			status: "READY_FOR_REVIEW" as const,
			uploadDate: "2026-01-01",
		} as WalletDocument;
		const slot = { id: "pension_notice", defaultTitle: "Erstrentenbescheid" };
		expect(doesDocumentMatchSlot(doc, slot)).toBe(true);
	});
});
