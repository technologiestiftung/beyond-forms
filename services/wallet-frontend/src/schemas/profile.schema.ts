import { z } from "zod";

const GenderEnum = z.enum(["Male", "Female", "Diverse"]);
export type GenderType = z.infer<typeof GenderEnum>;

const MaritalStatusEnum = z.enum([
	"Single",
	"Married",
	"Divorced",
	"Widowed",
	"Registered Civil Partnership",
]);
export type MaritalStatusType = z.infer<typeof MaritalStatusEnum>;

const DisplacedStatusEnum = z.enum([
	"Expellee (Resettler)",
	"Displaced Person (Resettler)",
	"Late Resettler",
	"Spouse or Descendant of a Late Resettler",
	"Soviet Zone Refugee",
	"none",
]);
export type DisplacedStatusType = z.infer<typeof DisplacedStatusEnum>;

const SocialSecurityTypeEnum = z.enum([
	"None",
	"Pension Insurance",
	"Long-term Care Insurance",
]);
export type SocialSecurityType = z.infer<typeof SocialSecurityTypeEnum>;

export const HealthInsuranceStatusEnum = z.enum([
	"Compulsory Insurance",
	"Voluntary Insurance",
	"Family Insurance",
	"Private Insurance",
	"Care by Health Funds under § 264 SGB V",
]);
export type HealthInsuranceStatus = z.infer<typeof HealthInsuranceStatusEnum>;

export const ResidenceStatusEnum = z.enum([
	"Citizen",
	"PermanentResident",
	"AsylumSeeker",
	"Other",
]);
export type ResidenceStatusType = z.infer<typeof ResidenceStatusEnum>;

export const DocumentTypeEnum = z.enum([
	"id_card",
	"registration",
	"health_insurance",
	"health_insurance_proof",
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
	"ID_CARD",
	"PASSPORT",
	"RENTAL_CONTRACT",
	"PENSION_STATEMENT",
	"BANK_STATEMENT",
	"HEATING_BILL",
	"OTHER",
	"tbd",
]);
export type DocumentType = z.infer<typeof DocumentTypeEnum>;

export const ProcessingStatusEnum = z.enum([
	"PENDING",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
	"READY_FOR_REVIEW",
	"VERIFIED",
]);
export type ProcessingStatus = z.infer<typeof ProcessingStatusEnum>;

const DateStringSchema = z
	.string()
	.refine((val) => {
		if (!val) {
			return true;
		}
		return /^\d{4}-\d{2}-\d{2}$/.test(val);
	}, "Invalid date format (YYYY-MM-DD)")
	.refine((val) => {
		if (!val) {
			return true;
		}
		const [year, month, day] = val.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		return (
			date.getFullYear() === year &&
			date.getMonth() === month - 1 &&
			date.getDate() === day
		);
	}, "Invalid date");

export const DraftPersonalDataSchema = z.object({
	firstName: z.string().max(255).nullable().optional(),
	lastName: z.string().max(255).nullable().optional(),
	dateOfBirth: DateStringSchema.nullable().optional(),
	placeOfBirth: z.string().max(255).nullable().optional(),
	legalGender: GenderEnum.nullable().optional(),
	nationality: z.string().max(255).nullable().optional(),
	secondNationality: z.string().max(255).nullable().optional(),
	maritalStatus: MaritalStatusEnum.nullable().optional(),
	birthName: z.string().max(255).nullable().optional(),
	residenceStatus: z.string().max(255).nullable().optional(),
	isGermanCitizen: z.boolean().nullable().optional(),
	identificationNumbers: z.string().max(255).nullable().optional(),
	taxId: z.string().max(255).nullable().optional(),
	hasCustodian: z.boolean().optional().nullable(),
	hasGuardian: z.boolean().optional().nullable(),
	displacedStatus: DisplacedStatusEnum.optional().nullable(),
	displacedIssuedOn: DateStringSchema.optional().nullable(),
	displacedIssuedBy: z.string().max(255).optional().nullable(),
	socialSecurityType: SocialSecurityTypeEnum.optional().nullable(),
	healthInsuranceStatus: HealthInsuranceStatusEnum.optional().nullable(),
	hasAppliedForAsylumBenefits: z.boolean().optional().nullable(),
	hasReceivedPreviousBenefits: z.boolean().optional().nullable(),
	previousBenefitsPeriod: z.string().max(255).optional().nullable(),
	previousBenefitsAuthority: z.string().max(255).optional().nullable(),
	previousBenefitsRefNo: z.string().max(255).optional().nullable(),
	isCurrentlyEmployed: z.boolean().optional().nullable(),
});
export type DraftPersonalData = z.infer<typeof DraftPersonalDataSchema>;

export const PersonalDataSchema = DraftPersonalDataSchema.extend({
	firstName: z.string().min(1, "errors.firstName_required").max(255),
	lastName: z.string().min(1, "errors.lastName_required").max(255),
	placeOfBirth: z.string().min(1, "errors.placeOfBirth_required").max(255),
	dateOfBirth: DateStringSchema,
	legalGender: GenderEnum,
});
export type PersonalData = z.infer<typeof PersonalDataSchema>;

export const AddressSchema = z.object({
	street: z.string().max(255).nullable().optional(),
	houseNumber: z.string().max(20).nullable().optional(),
	zipCode: z.string().max(10).nullable().optional(),
	city: z.string().max(255).nullable().optional(),
	state: z.string().max(255).nullable().optional(),
	district: z.string().max(255).nullable().optional(),
});
export type Address = z.infer<typeof AddressSchema>;

export const ProfileEditFormSchema = DraftPersonalDataSchema.partial()
	.extend(AddressSchema.partial().shape)
	.extend({
		legalGender: GenderEnum.nullable().optional().or(z.literal("")),
		maritalStatus: MaritalStatusEnum.nullable().optional().or(z.literal("")),
	});
export type ProfileEditForm = z.infer<typeof ProfileEditFormSchema>;

export const DraftProfileUpdatePayloadSchema =
	DraftPersonalDataSchema.partial().extend({
		street: z.string().max(255).nullable().optional(),
		houseNumber: z.string().max(20).nullable().optional(),
		zipCode: z.string().max(10).nullable().optional(),
		city: z.string().max(255).nullable().optional(),
		state: z.string().max(255).nullable().optional(),
	});
export type DraftProfileUpdatePayload = z.infer<
	typeof DraftProfileUpdatePayloadSchema
>;

export const ProfileUpdatePayloadSchema = PersonalDataSchema.partial().extend({
	street: z.string().max(255).optional(),
	houseNumber: z.string().max(20).optional(),
	zipCode: z.string().max(10).optional(),
	city: z.string().max(255).optional(),
	state: z.string().max(255).optional(),
});
export type ProfileUpdatePayload = z.infer<typeof ProfileUpdatePayloadSchema>;

export const CompleteAddressSchema = AddressSchema.extend({
	street: z.string().min(1),
	zipCode: z.string().min(1),
	city: z.string().min(1),
});

export const ContactSchema = z.object({
	email: z.string().email().optional().or(z.literal("")),
	phoneNumber: z.string().max(50).optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const CompleteContactSchema = ContactSchema.refine(
	(data) => !!(data.email || data.phoneNumber),
	{ message: "Either email or phone number must be provided" },
);

export const BankSchema = z.object({
	bankName: z.string().max(255).optional().nullable(),
	accountHolder: z.string().max(255).optional().nullable(),
	iban: z
		.preprocess(
			(val) => (typeof val === "string" ? val.replace(/\s+/g, "") : val),
			z
				.string()
				.max(50)
				.regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{12,30}$/i, "Invalid IBAN format"),
		)
		.optional()
		.nullable(),
	bic: z
		.string()
		.max(11)
		.regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i, "Invalid BIC format")
		.optional()
		.nullable(),
});
export type Bank = z.infer<typeof BankSchema>;

export const CompleteBankSchema = BankSchema.extend({
	bankName: z.string().min(1),
	accountHolder: z.string().min(1),
	iban: z.string().min(1),
});

export const FinancialDataSchema = z.object({
	incomeSources: z.array(z.string()).optional(),
	monthlyIncome: z.number().nonnegative().optional().nullable(),
	hasAssets: z.boolean().optional(),
	assetsDescription: z.string().max(1000).optional(),
	assetsTypes: z.array(z.string()).optional(),
	bankDetails: BankSchema,
	hasAppliedForBenefitsAwaitingDecision: z.boolean().optional().nullable(),
	benefitsAwaitingDecisionType: z.string().max(255).optional().nullable(),
	benefitsAwaitingDecisionApplicationDate:
		DateStringSchema.optional().nullable(),
	benefitsAwaitingDecisionOffice: z.string().max(255).optional().nullable(),
	benefitsAwaitingDecisionReference: z.string().max(255).optional().nullable(),
	areOneTimePaymentsExpected: z.boolean().optional().nullable(),
	oneTimePaymentsExpectedType: z.string().max(255).optional().nullable(),
	oneTimePaymentsExpectedAmount: z.number().nonnegative().optional().nullable(),
	oneTimePaymentsExpectedDate: DateStringSchema.optional().nullable(),
});
export type FinancialData = z.infer<typeof FinancialDataSchema>;

const normalizeDocumentType = (val: unknown): string => {
	if (typeof val !== "string") {
		return "OTHER";
	}
	const lower = val.toLowerCase().trim();
	const validOptions = [
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
	];
	if (validOptions.includes(lower)) {
		return lower;
	}
	if (lower === "passport" || lower === "identity_document") {
		return "id_card";
	}
	if (lower === "pension_statement") {
		return "pension_notice";
	}
	if (lower === "rental_contract") {
		return "rent";
	}
	if (lower === "bank_statement" || lower === "bank_statements") {
		return "stmt3";
	}
	if (lower === "heating_bill" || lower === "heating_costs_proof") {
		return "heating";
	}
	if (lower === "utility_cost_statement") {
		return "utility_bill";
	}

	if (lower === "tbd") {
		return "tbd";
	}
	return "OTHER";
};

export const DocumentSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.preprocess(normalizeDocumentType, DocumentTypeEnum),
	status: ProcessingStatusEnum,
	confidence: z.number().min(0).max(1).optional(),
	uploadDate: z.string(),
	updatedAt: z.string().optional(),
	fileUrl: z.string().url().optional(),
	user_error_code: z.string().optional(),
});
export type WalletDocument = z.infer<typeof DocumentSchema>;

export const HouseholdDataSchema = z.object({
	personsInHouseholdCount: z.number().int().nonnegative().optional(),
	maritalStatus: MaritalStatusEnum.optional(),
	marriedSince: DateStringSchema.optional().nullable(),
});
export type HouseholdData = z.infer<typeof HouseholdDataSchema>;

export const HousingDataSchema = z.object({
	accomodationType: z
		.enum([
			"Rental Apartment",
			"Own Home",
			"Condominium",
			"Relative",
			"Shared Household",
		])
		.optional(),
	tenancyStatus: z.enum(["Main Tenant", "Subtenant"]).optional().nullable(),
	rentTotal: z.number().nonnegative().optional().nullable(),
	heatingCosts: z.number().nonnegative().optional().nullable(),
	livingArea: z.number().nonnegative().optional().nullable(),
	numberOfRooms: z.number().int().nonnegative().optional().nullable(),
	subletRoomCount: z.number().int().nonnegative().optional().nullable(),
	subletRentIncome: z.number().nonnegative().optional().nullable(),
	rentPaidUntil: DateStringSchema.optional().nullable(),
	landlordName: z.string().max(255).optional().nullable(),
	heatingType: z.string().max(255).optional().nullable(),
	freeHousingRightHolder: z.string().max(255).optional().nullable(),
	hotWaterCosts: z.number().nonnegative().optional().nullable(),
	cableTvCosts: z.number().nonnegative().optional().nullable(),
});
export type HousingData = z.infer<typeof HousingDataSchema>;

export const AbilityToWorkEnum = z.enum([
	"Fully able",
	"Temporarily disabled",
	"Permanently disabled",
]);
export type AbilityToWorkType = z.infer<typeof AbilityToWorkEnum>;

export const DisabilityMerkzeichenEnum = z.enum([
	"G",
	"aG",
	"H",
	"B",
	"Bl",
	"Gl",
	"TBl",
	"RF",
	"1 Kl",
	"EB",
	"VB",
	"T",
]);
export type DisabilityMerkzeichenType = z.infer<
	typeof DisabilityMerkzeichenEnum
>;

export const HealthDataSchema = z.object({
	hasDisabilityId: z.boolean().optional().nullable(),
	hasCostlyMedicalNutrition: z.boolean().optional().nullable(),
	isCareDependent: z.boolean().optional().nullable(),
	hasInpatientFacilityAccommodation: z.boolean().optional().nullable(),
	inpatientFacilityMoveInDate: DateStringSchema.optional().nullable(),
	inpatientFacilityLastResidence: z.string().max(255).optional().nullable(),
	reducedWorkCapacityStartDate: DateStringSchema.optional().nullable(),
	reducedWorkCapacityEndDate: DateStringSchema.optional().nullable(),
	reducedWorkCapacityReason: z.string().optional().nullable(),
	abilityToWork: AbilityToWorkEnum.optional().nullable(),
	disabilityValidUntil: DateStringSchema.optional().nullable(),
	merkzeichen: DisabilityMerkzeichenEnum.optional().nullable(),
});
export type HealthData = z.infer<typeof HealthDataSchema>;

export const SettingsSchema = z.object({
	language: z.enum(["de", "en"]),
	notificationsEnabled: z.boolean(),
	personaAddress: z.enum(["Formal", "Informal"]), // Sie vs Du
	displayName: z.string().min(1).max(255).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ProfileSchema = z.object({
	personalData: PersonalDataSchema,
	address: AddressSchema,
	contact: ContactSchema,
	financial: FinancialDataSchema,
	household: HouseholdDataSchema,
	housing: HousingDataSchema,
	health: HealthDataSchema,
	documents: z.array(DocumentSchema),
	settings: SettingsSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
