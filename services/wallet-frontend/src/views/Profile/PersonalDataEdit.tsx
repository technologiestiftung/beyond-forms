import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import type {
	UseFormRegisterReturn,
	UseFormRegister,
	FieldErrors,
	Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProfileEditFormSchema } from "../../schemas/profile.schema";
import type { ProfileEditForm, Profile } from "../../schemas/profile.schema";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useProfile } from "../../hooks/useProfile";
import { AlertCircle, CheckCircle2, Loader2, Pencil } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { COUNTRY_OPTIONS } from "../../constants/countries";

type CombinedWizardFormValues = ProfileEditForm;

/**
 * Converts an untouched/cleared number input ("") to undefined rather than
 * NaN, so optional numeric fields don't fail validation until a value is
 * actually entered.
 */
const emptyStringToUndefinedNumber = (value: string): number | undefined =>
	value === "" ? undefined : Number(value);

interface FieldProps {
	id: string;
	label: string;
	type?: string;
	placeholder?: string;
	register: UseFormRegisterReturn;
	onBlur?: () => void;
	error?: string;
	hint?: string;
}

const FormField: React.FC<FieldProps> = ({
	id,
	label,
	type = "text",
	placeholder,
	register,
	onBlur,
	error,
	hint,
}) => {
	const { t } = useTranslation("profile");
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	const describedBy = [error ? errorId : null, hint ? hintId : null]
		.filter(Boolean)
		.join(" ");

	return (
		<div className="flex flex-col gap-1 text-left relative pb-3 border-b border-slate-100 last:border-b-0 focus-within:border-primary-green-300 transition-all">
			<label
				htmlFor={id}
				className="text-xs font-bold text-slate-500 uppercase tracking-wide"
			>
				{label}
			</label>
			<div className="relative flex items-center w-full mt-0.5">
				<input
					id={id}
					type={type}
					placeholder={placeholder}
					{...register}
					onChange={(e) => {
						if (type === "number" || register.name === "zipCode") {
							e.target.value = e.target.value.replace(/[^0-9.,]/g, "");
						}
						void register.onChange(e);
					}}
					onBlur={(e) => {
						void register.onBlur(e);
						onBlur?.();
					}}
					aria-invalid={!!error}
					aria-describedby={describedBy || undefined}
					data-testid={`field-${id}-input`}
					className="w-full pr-14 bg-transparent border-none focus:outline-none font-bold text-slate-900 text-base placeholder:font-normal placeholder:text-brand-grey"
				/>
				<button
					type="button"
					aria-label={`${label} bearbeiten`}
					onClick={() => document.getElementById(id)?.focus()}
					className="absolute right-0 min-w-[44px] min-h-[44px] size-11 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0 focus-visible:outline-2 focus-visible:outline-brand-primary"
				>
					<Pencil className="size-4" />
				</button>
			</div>
			{hint && (
				<p
					id={hintId}
					className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 px-1"
				>
					{hint}
				</p>
			)}
			{error && (
				<span
					id={errorId}
					data-testid={`field-${id}-error`}
					className="text-xs text-rose-600 font-semibold mt-1"
				>
					{t(error)}
				</span>
			)}
		</div>
	);
};

const SelectField: React.FC<
	FieldProps & {
		options: { code: string; name: string }[];
		placeholderText: string;
	}
> = ({
	id,
	label,
	register,
	onBlur,
	error,
	hint,
	options,
	placeholderText,
}) => {
	const { t } = useTranslation("profile");
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	const describedBy = [error ? errorId : null, hint ? hintId : null]
		.filter(Boolean)
		.join(" ");

	return (
		<div className="flex flex-col gap-1.5 text-left w-full">
			<label
				htmlFor={id}
				className="text-xs font-bold text-slate-500 uppercase tracking-wide"
			>
				{label}
			</label>
			<select
				id={id}
				{...register}
				onBlur={(e) => {
					void register.onBlur(e);
					onBlur?.();
				}}
				aria-invalid={!!error}
				aria-describedby={describedBy || undefined}
				data-testid={`field-${id}-select`}
				className={`h-12 px-4 rounded-xl border ${error ? "border-rose-400 focus:ring-rose-200" : "border-slate-200 focus:ring-primary-green-200"} focus:outline-none focus:ring-2 focus:ring-primary-green-500/20 bg-slate-50/50 font-medium text-slate-800 text-sm transition-all`}
			>
				<option value="">{placeholderText}</option>
				{options.map((o) => (
					<option key={o.code} value={o.code}>
						{o.name}
					</option>
				))}
			</select>
			{hint && (
				<p
					id={hintId}
					className="text-[11px] text-slate-500 font-medium leading-relaxed px-1 mt-0.5"
				>
					{hint}
				</p>
			)}
			{error && (
				<span
					id={errorId}
					data-testid={`field-${id}-error`}
					className="text-xs text-rose-600 font-semibold mt-0.5"
				>
					{t(error)}
				</span>
			)}
		</div>
	);
};

const CheckboxField: React.FC<{
	id: string;
	label: string;
	register: UseFormRegisterReturn;
	onBlur?: () => void;
	hint?: string;
}> = ({ id, label, register, onBlur, hint }) => {
	return (
		<label
			htmlFor={id}
			className="flex items-start gap-3 text-left py-2 border-b border-slate-100 last:border-b-0 cursor-pointer"
		>
			<input
				id={id}
				type="checkbox"
				{...register}
				onBlur={(e) => {
					void register.onBlur(e);
					onBlur?.();
				}}
				data-testid={`field-${id}-checkbox`}
				className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-primary-green-500 focus:ring-primary-green-500/40"
			/>
			<span className="flex flex-col gap-0.5">
				<span className="text-sm font-bold text-slate-800">{label}</span>
				{hint && <span className="text-[11px] text-slate-500">{hint}</span>}
			</span>
		</label>
	);
};

/**
 * A checkbox group sharing a single registered field name, so react-hook-form
 * collects the checked values into a string array (used for e.g. incomeSources).
 */
const MultiCheckboxField: React.FC<{
	legend: string;
	name: keyof CombinedWizardFormValues & string;
	options: { code: string; name: string }[];
	register: UseFormRegister<CombinedWizardFormValues>;
	onBlur?: () => void;
}> = ({ legend, name, options, register, onBlur }) => {
	return (
		<fieldset className="flex flex-col gap-2 text-left w-full">
			<legend className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
				{legend}
			</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((o) => (
					<label
						key={o.code}
						htmlFor={`${name}-${o.code}`}
						className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer has-checked:border-primary-green-300 has-checked:bg-primary-green-50"
					>
						<input
							id={`${name}-${o.code}`}
							type="checkbox"
							value={o.code}
							{...register(name)}
							onBlur={(e) => {
								void register(name).onBlur(e);
								onBlur?.();
							}}
							className="size-3.5 rounded border-slate-300 text-primary-green-500 focus:ring-primary-green-500/40"
						/>
						{o.name}
					</label>
				))}
			</div>
		</fieldset>
	);
};

function getProfileFormDefaults(
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
const FIELD_SECTION: Record<string, keyof Profile> = {
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
const BANK_FIELDS = new Set(["bankName", "accountHolder", "iban", "bic"]);

interface SectionProps {
	register: UseFormRegister<CombinedWizardFormValues>;
	formErrors: FieldErrors<CombinedWizardFormValues>;
	handleFieldBlur: (fieldName: keyof CombinedWizardFormValues & string) => void;
	t: TFunction;
}

const IdentitySection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.identity", "Rechtliche Identität")}
			</h2>

			<SelectField
				id="legalGender"
				label={t("personal.fields.legalGender")}
				register={register("legalGender")}
				onBlur={() => handleFieldBlur("legalGender")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[
					{ code: "Female", name: t("personal.gender.Female") },
					{ code: "Male", name: t("personal.gender.Male") },
					{ code: "Diverse", name: t("personal.gender.Diverse") },
				]}
				error={formErrors.legalGender?.message}
				hint={t("personal.gender.hint")}
			/>

			<FormField
				id="firstName"
				label={t("personal.fields.firstName")}
				register={register("firstName")}
				onBlur={() => handleFieldBlur("firstName")}
				error={formErrors.firstName?.message}
			/>
			<FormField
				id="lastName"
				label={t("personal.fields.lastName")}
				register={register("lastName")}
				onBlur={() => handleFieldBlur("lastName")}
				error={formErrors.lastName?.message}
			/>
			<FormField
				id="birthName"
				label={t("personal.fields.birthName")}
				register={register("birthName")}
				onBlur={() => handleFieldBlur("birthName")}
			/>
			<FormField
				id="dateOfBirth"
				label={t("personal.fields.dateOfBirth")}
				type="date"
				register={register("dateOfBirth")}
				onBlur={() => handleFieldBlur("dateOfBirth")}
				error={formErrors.dateOfBirth?.message}
			/>
			<SelectField
				id="placeOfBirth"
				label={t("personal.fields.placeOfBirth")}
				register={register("placeOfBirth")}
				onBlur={() => handleFieldBlur("placeOfBirth")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={COUNTRY_OPTIONS.map((c) => ({
					code: c.code,
					name: t(`personal.countries.${c.code}`),
				}))}
				error={formErrors.placeOfBirth?.message}
			/>
			<CheckboxField
				id="isGermanCitizen"
				label={t(
					"personal.fields.isGermanCitizen",
					"Ich bin deutsche(r) Staatsbürger(in)",
				)}
				register={register("isGermanCitizen")}
				onBlur={() => handleFieldBlur("isGermanCitizen")}
			/>
			<CheckboxField
				id="isResidentInGermany"
				label={t(
					"personal.fields.isResidentInGermany",
					"Ich habe meinen gewöhnlichen Aufenthalt in Deutschland",
				)}
				register={register("isResidentInGermany")}
				onBlur={() => handleFieldBlur("isResidentInGermany")}
			/>
			<CheckboxField
				id="isVictimOfNationalSocialistPersecution"
				label={t(
					"personal.fields.isVictimOfNationalSocialistPersecution",
					"Ich bin Verfolgte(r) des Nationalsozialismus",
				)}
				register={register("isVictimOfNationalSocialistPersecution")}
				onBlur={() => handleFieldBlur("isVictimOfNationalSocialistPersecution")}
			/>
		</div>
	);
};

const DISPLACED_STATUS_OPTIONS = [
	"Expellee (Resettler)",
	"Displaced Person (Resettler)",
	"Late Resettler",
	"Spouse or Descendant of a Late Resettler",
	"Soviet Zone Refugee",
	"none",
] as const;

const StatusSection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.status", "Staatsangehörigkeit und Status")}
			</h2>
			<SelectField
				id="nationality"
				label={t("personal.fields.nationality")}
				register={register("nationality")}
				onBlur={() => handleFieldBlur("nationality")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={COUNTRY_OPTIONS.map((c) => ({
					code: c.code,
					name: t(`personal.countries.${c.code}`),
				}))}
				error={formErrors.nationality?.message}
			/>
			<SelectField
				id="secondNationality"
				label={t("personal.fields.secondNationality")}
				register={register("secondNationality")}
				onBlur={() => handleFieldBlur("secondNationality")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={COUNTRY_OPTIONS.map((c) => ({
					code: c.code,
					name: t(`personal.countries.${c.code}`),
				}))}
			/>
			<FormField
				id="residenceStatus"
				label={t("personal.fields.residenceStatus")}
				register={register("residenceStatus")}
				onBlur={() => handleFieldBlur("residenceStatus")}
			/>
			<SelectField
				id="maritalStatus"
				label={t("personal.fields.maritalStatus")}
				register={register("maritalStatus")}
				onBlur={() => handleFieldBlur("maritalStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[
					{ code: "Single", name: t("personal.maritalStatus.Single") },
					{ code: "Married", name: t("personal.maritalStatus.Married") },
					{ code: "Divorced", name: t("personal.maritalStatus.Divorced") },
					{ code: "Widowed", name: t("personal.maritalStatus.Widowed") },
					{
						code: "Registered Civil Partnership",
						name: t("personal.maritalStatus.Registered Civil Partnership"),
					},
				]}
				error={formErrors.maritalStatus?.message}
			/>
			<SelectField
				id="displacedStatus"
				label={t("personal.fields.displacedStatus", "Vertriebenenstatus")}
				register={register("displacedStatus")}
				onBlur={() => handleFieldBlur("displacedStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={DISPLACED_STATUS_OPTIONS.map((code) => ({
					code,
					name: t(`personal.displacedStatus.${code}`, code),
				}))}
			/>
			<FormField
				id="identificationNumbers"
				label={t("personal.fields.identificationNumbers")}
				register={register("identificationNumbers")}
				onBlur={() => handleFieldBlur("identificationNumbers")}
			/>
			<FormField
				id="taxId"
				label={t("personal.fields.taxId")}
				register={register("taxId")}
				onBlur={() => handleFieldBlur("taxId")}
			/>
			<CheckboxField
				id="hasGuardian"
				label={t("personal.fields.hasGuardian", "Ich werde rechtlich betreut")}
				register={register("hasGuardian")}
				onBlur={() => handleFieldBlur("hasGuardian")}
			/>
			<CheckboxField
				id="hasCustodian"
				label={t("personal.fields.hasCustodian", "Ich habe Beistand")}
				register={register("hasCustodian")}
				onBlur={() => handleFieldBlur("hasCustodian")}
			/>
		</div>
	);
};

const AddressSection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.address", "Meldeadresse")}
			</h2>
			<FormField
				id="street"
				label={t("personal.fields.street")}
				register={register("street")}
				onBlur={() => handleFieldBlur("street")}
				error={formErrors.street?.message}
			/>
			<FormField
				id="houseNumber"
				label={t("personal.fields.houseNumber")}
				register={register("houseNumber")}
				onBlur={() => handleFieldBlur("houseNumber")}
				error={formErrors.houseNumber?.message}
			/>
			<SelectField
				id="city"
				label={t("personal.fields.city")}
				register={register("city")}
				onBlur={() => handleFieldBlur("city")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[{ code: "Berlin", name: "Berlin" }]}
				error={formErrors.city?.message}
			/>
			<SelectField
				id="state"
				label={t("personal.fields.state")}
				register={register("state")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[{ code: "Berlin", name: "Berlin" }]}
			/>
			<FormField
				id="zipCode"
				label={t("personal.fields.zipCode")}
				register={register("zipCode")}
				onBlur={() => handleFieldBlur("zipCode")}
				error={formErrors.zipCode?.message}
			/>
		</div>
	);
};

const ContactSection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.contact", "Kontakt")}
			</h2>
			<FormField
				id="email"
				label={t("personal.fields.email", "E-Mail-Adresse")}
				type="email"
				register={register("email")}
				onBlur={() => handleFieldBlur("email")}
				error={formErrors.email?.message}
			/>
			<FormField
				id="phoneNumber"
				label={t("personal.fields.phoneNumber", "Telefonnummer")}
				register={register("phoneNumber")}
				onBlur={() => handleFieldBlur("phoneNumber")}
				error={formErrors.phoneNumber?.message}
			/>
		</div>
	);
};

const VehicleSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.vehicle", "Fahrzeug")}
			</h2>
			<FormField
				id="licensePlate"
				label={t("personal.fields.licensePlate", "Kfz-Kennzeichen")}
				placeholder={t(
					"personal.fields.licensePlate_placeholder",
					"z. B. B-XY 1234",
				)}
				register={register("licensePlate")}
				onBlur={() => handleFieldBlur("licensePlate")}
				hint={t(
					"personal.fields.licensePlate_hint",
					"Wird für den Bewohnerparkausweis benötigt.",
				)}
			/>
		</div>
	);
};

const SOCIAL_SECURITY_OPTIONS = [
	"None",
	"Pension Insurance",
	"Long-term Care Insurance",
] as const;

const HEALTH_INSURANCE_STATUS_OPTIONS = [
	"Compulsory Insurance",
	"Voluntary Insurance",
	"Family Insurance",
	"Private Insurance",
	"Care by Health Funds under § 264 SGB V",
] as const;

const InsuranceSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.insurance", "Versicherung und Erwerbstätigkeit")}
			</h2>
			<SelectField
				id="socialSecurityType"
				label={t(
					"personal.fields.socialSecurityType",
					"Sozialversicherung",
				)}
				register={register("socialSecurityType")}
				onBlur={() => handleFieldBlur("socialSecurityType")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={SOCIAL_SECURITY_OPTIONS.map((code) => ({
					code,
					name: t(`personal.socialSecurityType.${code}`, code),
				}))}
			/>
			<SelectField
				id="healthInsuranceStatus"
				label={t(
					"personal.fields.healthInsuranceStatus",
					"Art der Krankenversicherung",
				)}
				register={register("healthInsuranceStatus")}
				onBlur={() => handleFieldBlur("healthInsuranceStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={HEALTH_INSURANCE_STATUS_OPTIONS.map((code) => ({
					code,
					name: t(`personal.healthInsuranceStatus.${code}`, code),
				}))}
			/>
			<FormField
				id="healthInsuranceProvider"
				label={t(
					"personal.fields.healthInsuranceProvider",
					"Krankenkasse",
				)}
				register={register("healthInsuranceProvider")}
				onBlur={() => handleFieldBlur("healthInsuranceProvider")}
			/>
			<FormField
				id="pensionInsuranceProvider"
				label={t(
					"personal.fields.pensionInsuranceProvider",
					"Rentenversicherungsträger",
				)}
				register={register("pensionInsuranceProvider")}
				onBlur={() => handleFieldBlur("pensionInsuranceProvider")}
			/>
			<FormField
				id="pensionInsuranceNo"
				label={t(
					"personal.fields.pensionInsuranceNo",
					"Rentenversicherungsnummer",
				)}
				register={register("pensionInsuranceNo")}
				onBlur={() => handleFieldBlur("pensionInsuranceNo")}
			/>
			<CheckboxField
				id="isCurrentlyEmployed"
				label={t(
					"personal.fields.isCurrentlyEmployed",
					"Ich bin aktuell erwerbstätig",
				)}
				register={register("isCurrentlyEmployed")}
				onBlur={() => handleFieldBlur("isCurrentlyEmployed")}
			/>
			<CheckboxField
				id="isStudentOrTrainee"
				label={t(
					"personal.fields.isStudentOrTrainee",
					"Ich bin Schüler(in), Studierende(r) oder Auszubildende(r)",
				)}
				register={register("isStudentOrTrainee")}
				onBlur={() => handleFieldBlur("isStudentOrTrainee")}
			/>
			<CheckboxField
				id="hasAppliedForAsylumBenefits"
				label={t(
					"personal.fields.hasAppliedForAsylumBenefits",
					"Ich habe Leistungen nach dem Asylbewerberleistungsgesetz beantragt",
				)}
				register={register("hasAppliedForAsylumBenefits")}
				onBlur={() => handleFieldBlur("hasAppliedForAsylumBenefits")}
			/>
			<CheckboxField
				id="hasReceivedPreviousBenefits"
				label={t(
					"personal.fields.hasReceivedPreviousBenefits",
					"Ich habe bereits einmal Sozialleistungen erhalten",
				)}
				register={register("hasReceivedPreviousBenefits")}
				onBlur={() => handleFieldBlur("hasReceivedPreviousBenefits")}
			/>
			<FormField
				id="previousBenefitsAuthority"
				label={t(
					"personal.fields.previousBenefitsAuthority",
					"Bewilligende Behörde",
				)}
				register={register("previousBenefitsAuthority")}
				onBlur={() => handleFieldBlur("previousBenefitsAuthority")}
			/>
			<FormField
				id="previousBenefitsPeriod"
				label={t(
					"personal.fields.previousBenefitsPeriod",
					"Bewilligungszeitraum",
				)}
				register={register("previousBenefitsPeriod")}
				onBlur={() => handleFieldBlur("previousBenefitsPeriod")}
			/>
			<FormField
				id="previousBenefitsRefNo"
				label={t(
					"personal.fields.previousBenefitsRefNo",
					"Aktenzeichen",
				)}
				register={register("previousBenefitsRefNo")}
				onBlur={() => handleFieldBlur("previousBenefitsRefNo")}
			/>
		</div>
	);
};

const HouseholdSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.household", "Haushalt")}
			</h2>
			<FormField
				id="personsInHouseholdCount"
				label={t(
					"personal.fields.personsInHouseholdCount",
					"Personen im Haushalt",
				)}
				type="number"
				register={register("personsInHouseholdCount", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("personsInHouseholdCount")}
			/>
			<FormField
				id="marriedSince"
				label={t("personal.fields.marriedSince", "Verheiratet seit")}
				type="date"
				register={register("marriedSince")}
				onBlur={() => handleFieldBlur("marriedSince")}
			/>
		</div>
	);
};

const ACCOMODATION_TYPE_OPTIONS = [
	"Rental Apartment",
	"Own Home",
	"Condominium",
	"Relative",
	"Shared Household",
] as const;

const HousingSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.housing", "Wohnsituation")}
			</h2>
			<SelectField
				id="accomodationType"
				label={t("personal.fields.accomodationType", "Wohnform")}
				register={register("accomodationType")}
				onBlur={() => handleFieldBlur("accomodationType")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={ACCOMODATION_TYPE_OPTIONS.map((code) => ({
					code,
					name: t(`personal.accomodationType.${code}`, code),
				}))}
			/>
			<SelectField
				id="tenancyStatus"
				label={t("housing.fields.tenancyStatus")}
				register={register("tenancyStatus")}
				onBlur={() => handleFieldBlur("tenancyStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[
					{
						code: "Main Tenant",
						name: t("housing.tenancyStatus.Main Tenant"),
					},
					{ code: "Subtenant", name: t("housing.tenancyStatus.Subtenant") },
				]}
			/>
			<FormField
				id="rentTotal"
				label={t("housing.fields.rentTotal")}
				type="number"
				register={register("rentTotal", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("rentTotal")}
			/>
			<FormField
				id="heatingCosts"
				label={t("housing.fields.heatingCosts")}
				type="number"
				register={register("heatingCosts", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("heatingCosts")}
			/>
			<FormField
				id="hotWaterCosts"
				label={t("personal.fields.hotWaterCosts", "Warmwasserkosten (€)")}
				type="number"
				register={register("hotWaterCosts", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("hotWaterCosts")}
			/>
			<FormField
				id="cableTvCosts"
				label={t("personal.fields.cableTvCosts", "Kabel-/TV-Kosten (€)")}
				type="number"
				register={register("cableTvCosts", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("cableTvCosts")}
			/>
			<FormField
				id="livingArea"
				label={t("housing.fields.livingArea")}
				type="number"
				register={register("livingArea", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("livingArea")}
			/>
			<FormField
				id="numberOfRooms"
				label={t("housing.fields.numberOfRooms")}
				type="number"
				register={register("numberOfRooms", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("numberOfRooms")}
			/>
			<FormField
				id="landlordName"
				label={t("personal.fields.landlordName", "Vermieter(in)")}
				register={register("landlordName")}
				onBlur={() => handleFieldBlur("landlordName")}
			/>
			<FormField
				id="heatingType"
				label={t("personal.fields.heatingType", "Heizungsart")}
				register={register("heatingType")}
				onBlur={() => handleFieldBlur("heatingType")}
			/>
			<FormField
				id="rentPaidUntil"
				label={t("personal.fields.rentPaidUntil", "Miete bezahlt bis")}
				type="date"
				register={register("rentPaidUntil")}
				onBlur={() => handleFieldBlur("rentPaidUntil")}
			/>
			<FormField
				id="subletRoomCount"
				label={t("personal.fields.subletRoomCount", "Untervermietete Zimmer")}
				type="number"
				register={register("subletRoomCount", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("subletRoomCount")}
			/>
			<FormField
				id="subletRentIncome"
				label={t(
					"personal.fields.subletRentIncome",
					"Einnahmen aus Untervermietung (€)",
				)}
				type="number"
				register={register("subletRentIncome", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("subletRentIncome")}
			/>
			<FormField
				id="freeHousingRightHolder"
				label={t(
					"personal.fields.freeHousingRightHolder",
					"Inhaber(in) des freien Wohnrechts",
				)}
				register={register("freeHousingRightHolder")}
				onBlur={() => handleFieldBlur("freeHousingRightHolder")}
			/>
			<CheckboxField
				id="isSubsidizedHousing"
				label={t(
					"personal.fields.isSubsidizedHousing",
					"Ich wohne in einer öffentlich geförderten Wohnung",
				)}
				register={register("isSubsidizedHousing")}
				onBlur={() => handleFieldBlur("isSubsidizedHousing")}
			/>
			<CheckboxField
				id="hasOtherResidence"
				label={t(
					"personal.fields.hasOtherResidence",
					"Ich habe eine weitere Unterkunft",
				)}
				register={register("hasOtherResidence")}
				onBlur={() => handleFieldBlur("hasOtherResidence")}
			/>
			<CheckboxField
				id="hasSecondaryResidence"
				label={t(
					"personal.fields.hasSecondaryResidence",
					"Ich habe einen Zweitwohnsitz",
				)}
				register={register("hasSecondaryResidence")}
				onBlur={() => handleFieldBlur("hasSecondaryResidence")}
			/>
			<CheckboxField
				id="hasGarageCosts"
				label={t(
					"personal.fields.hasGarageCosts",
					"Ich zahle Kosten für eine Garage/einen Stellplatz",
				)}
				register={register("hasGarageCosts")}
				onBlur={() => handleFieldBlur("hasGarageCosts")}
			/>
			<FormField
				id="garageCosts"
				label={t("personal.fields.garageCosts", "Garagenkosten (€)")}
				type="number"
				register={register("garageCosts", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("garageCosts")}
			/>
			<CheckboxField
				id="hasHouseholdEnergyCosts"
				label={t(
					"personal.fields.hasHouseholdEnergyCosts",
					"Ich zahle Haushaltsenergiekosten",
				)}
				register={register("hasHouseholdEnergyCosts")}
				onBlur={() => handleFieldBlur("hasHouseholdEnergyCosts")}
			/>
			<FormField
				id="householdEnergyCosts"
				label={t(
					"personal.fields.householdEnergyCosts",
					"Haushaltsenergiekosten (€)",
				)}
				type="number"
				register={register("householdEnergyCosts", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("householdEnergyCosts")}
			/>
			<CheckboxField
				id="isLivingAreaUsedCommercially"
				label={t(
					"personal.fields.isLivingAreaUsedCommercially",
					"Ein Teil der Wohnfläche wird gewerblich genutzt",
				)}
				register={register("isLivingAreaUsedCommercially")}
				onBlur={() => handleFieldBlur("isLivingAreaUsedCommercially")}
			/>
			<FormField
				id="commerciallyUsedAreaSqm"
				label={t(
					"personal.fields.commerciallyUsedAreaSqm",
					"Gewerblich genutzte Fläche (m²)",
				)}
				type="number"
				register={register("commerciallyUsedAreaSqm", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("commerciallyUsedAreaSqm")}
			/>
		</div>
	);
};

const INCOME_SOURCE_OPTIONS = [
	"pension",
	"none_pension",
	"employment_employed",
	"employment_self",
	"employment_student",
	"employment_unemployed",
	"employment_none",
	"other_benefits",
	"other_alimony",
	"other_rent",
	"other_sick",
	"other",
	"none_other",
] as const;

const FinancialSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.financial", "Einkommen und Vermögen")}
			</h2>
			<FormField
				id="monthlyIncome"
				label={t("personal.fields.monthlyIncome", "Monatliches Einkommen (€)")}
				type="number"
				register={register("monthlyIncome", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("monthlyIncome")}
			/>
			<MultiCheckboxField
				legend={t("personal.fields.incomeSources", "Einkommensarten")}
				name="incomeSources"
				register={register}
				onBlur={() => handleFieldBlur("incomeSources")}
				options={INCOME_SOURCE_OPTIONS.map((code) => ({
					code,
					name: t(`personal.incomeSources.${code}`, code),
				}))}
			/>
			<CheckboxField
				id="hasAssets"
				label={t(
					"personal.fields.hasAssets",
					"Ich besitze Ersparnisse, Immobilien oder Wertgegenstände",
				)}
				register={register("hasAssets")}
				onBlur={() => handleFieldBlur("hasAssets")}
			/>
			<FormField
				id="assetsDescription"
				label={t(
					"personal.fields.assetsDescription",
					"Beschreibung des Vermögens",
				)}
				register={register("assetsDescription")}
				onBlur={() => handleFieldBlur("assetsDescription")}
			/>
			<FormField
				id="professionalExpenses"
				label={t(
					"personal.fields.professionalExpenses",
					"Werbungskosten (€)",
				)}
				type="number"
				register={register("professionalExpenses", { setValueAs: emptyStringToUndefinedNumber })}
				onBlur={() => handleFieldBlur("professionalExpenses")}
			/>
			<CheckboxField
				id="hasChildcareExpenses"
				label={t(
					"personal.fields.hasChildcareExpenses",
					"Ich habe Kinderbetreuungskosten",
				)}
				register={register("hasChildcareExpenses")}
				onBlur={() => handleFieldBlur("hasChildcareExpenses")}
			/>
			<CheckboxField
				id="gaveAwayAssetsLast10Years"
				label={t(
					"personal.fields.gaveAwayAssetsLast10Years",
					"Ich habe in den letzten 10 Jahren Vermögen verschenkt",
				)}
				register={register("gaveAwayAssetsLast10Years")}
				onBlur={() => handleFieldBlur("gaveAwayAssetsLast10Years")}
			/>
			<CheckboxField
				id="grossNegligenceLast10Years"
				label={t(
					"personal.fields.grossNegligenceLast10Years",
					"Ich habe in den letzten 10 Jahren grob fahrlässig Vermögen verringert",
				)}
				register={register("grossNegligenceLast10Years")}
				onBlur={() => handleFieldBlur("grossNegligenceLast10Years")}
			/>
			<CheckboxField
				id="hasAppliedForBenefitsAwaitingDecision"
				label={t(
					"personal.fields.hasAppliedForBenefitsAwaitingDecision",
					"Ich warte auf die Entscheidung über einen anderen Antrag",
				)}
				register={register("hasAppliedForBenefitsAwaitingDecision")}
				onBlur={() => handleFieldBlur("hasAppliedForBenefitsAwaitingDecision")}
			/>
			<FormField
				id="benefitsAwaitingDecisionType"
				label={t(
					"personal.fields.benefitsAwaitingDecisionType",
					"Art der beantragten Leistung",
				)}
				register={register("benefitsAwaitingDecisionType")}
				onBlur={() => handleFieldBlur("benefitsAwaitingDecisionType")}
			/>
			<FormField
				id="benefitsAwaitingDecisionApplicationDate"
				label={t(
					"personal.fields.benefitsAwaitingDecisionApplicationDate",
					"Antragsdatum",
				)}
				type="date"
				register={register("benefitsAwaitingDecisionApplicationDate")}
				onBlur={() =>
					handleFieldBlur("benefitsAwaitingDecisionApplicationDate")
				}
			/>
			<FormField
				id="benefitsAwaitingDecisionOffice"
				label={t(
					"personal.fields.benefitsAwaitingDecisionOffice",
					"Zuständige Behörde",
				)}
				register={register("benefitsAwaitingDecisionOffice")}
				onBlur={() => handleFieldBlur("benefitsAwaitingDecisionOffice")}
			/>
			<FormField
				id="benefitsAwaitingDecisionReference"
				label={t(
					"personal.fields.benefitsAwaitingDecisionReference",
					"Aktenzeichen",
				)}
				register={register("benefitsAwaitingDecisionReference")}
				onBlur={() => handleFieldBlur("benefitsAwaitingDecisionReference")}
			/>
			<CheckboxField
				id="areOneTimePaymentsExpected"
				label={t(
					"personal.fields.areOneTimePaymentsExpected",
					"Ich erwarte eine einmalige Zahlung",
				)}
				register={register("areOneTimePaymentsExpected")}
				onBlur={() => handleFieldBlur("areOneTimePaymentsExpected")}
			/>
			<FormField
				id="oneTimePaymentsExpectedType"
				label={t(
					"personal.fields.oneTimePaymentsExpectedType",
					"Art der einmaligen Zahlung",
				)}
				register={register("oneTimePaymentsExpectedType")}
				onBlur={() => handleFieldBlur("oneTimePaymentsExpectedType")}
			/>
			<FormField
				id="oneTimePaymentsExpectedAmount"
				label={t(
					"personal.fields.oneTimePaymentsExpectedAmount",
					"Höhe der einmaligen Zahlung (€)",
				)}
				type="number"
				register={register("oneTimePaymentsExpectedAmount", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("oneTimePaymentsExpectedAmount")}
			/>
			<FormField
				id="oneTimePaymentsExpectedDate"
				label={t(
					"personal.fields.oneTimePaymentsExpectedDate",
					"Datum der einmaligen Zahlung",
				)}
				type="date"
				register={register("oneTimePaymentsExpectedDate")}
				onBlur={() => handleFieldBlur("oneTimePaymentsExpectedDate")}
			/>
			<FormField
				id="bankName"
				label={t("personal.fields.bankName", "Bank")}
				register={register("bankName")}
				onBlur={() => handleFieldBlur("bankName")}
			/>
			<FormField
				id="accountHolder"
				label={t("personal.fields.accountHolder", "Kontoinhaber(in)")}
				register={register("accountHolder")}
				onBlur={() => handleFieldBlur("accountHolder")}
			/>
			<FormField
				id="iban"
				label={t("personal.fields.iban", "IBAN")}
				register={register("iban")}
				onBlur={() => handleFieldBlur("iban")}
			/>
			<FormField
				id="bic"
				label={t("personal.fields.bic", "BIC")}
				register={register("bic")}
				onBlur={() => handleFieldBlur("bic")}
			/>
		</div>
	);
};

const ABILITY_TO_WORK_OPTIONS = [
	"Fully able",
	"Temporarily disabled",
	"Permanently disabled",
] as const;

const MERKZEICHEN_OPTIONS = [
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
] as const;

const HealthSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.health", "Gesundheit und Pflege")}
			</h2>
			<SelectField
				id="abilityToWork"
				label={t("personal.fields.abilityToWork", "Erwerbsfähigkeit")}
				register={register("abilityToWork")}
				onBlur={() => handleFieldBlur("abilityToWork")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={ABILITY_TO_WORK_OPTIONS.map((code) => ({
					code,
					name: t(`personal.abilityToWork.${code}`, code),
				}))}
			/>
			<FormField
				id="reducedWorkCapacityStartDate"
				label={t(
					"personal.fields.reducedWorkCapacityStartDate",
					"Beginn der Erwerbsminderung",
				)}
				type="date"
				register={register("reducedWorkCapacityStartDate")}
				onBlur={() => handleFieldBlur("reducedWorkCapacityStartDate")}
			/>
			<FormField
				id="reducedWorkCapacityEndDate"
				label={t(
					"personal.fields.reducedWorkCapacityEndDate",
					"Voraussichtliches Ende der Erwerbsminderung",
				)}
				type="date"
				register={register("reducedWorkCapacityEndDate")}
				onBlur={() => handleFieldBlur("reducedWorkCapacityEndDate")}
			/>
			<FormField
				id="reducedWorkCapacityReason"
				label={t(
					"personal.fields.reducedWorkCapacityReason",
					"Grund der Erwerbsminderung",
				)}
				register={register("reducedWorkCapacityReason")}
				onBlur={() => handleFieldBlur("reducedWorkCapacityReason")}
			/>
			<CheckboxField
				id="hasPermanentReductionInEarningCapacity"
				label={t(
					"personal.fields.hasPermanentReductionInEarningCapacity",
					"Ich habe eine dauerhafte Erwerbsminderung",
				)}
				register={register("hasPermanentReductionInEarningCapacity")}
				onBlur={() => handleFieldBlur("hasPermanentReductionInEarningCapacity")}
			/>
			<CheckboxField
				id="hasDisabilityId"
				label={t(
					"personal.fields.hasDisabilityId",
					"Ich habe einen Schwerbehindertenausweis",
				)}
				register={register("hasDisabilityId")}
				onBlur={() => handleFieldBlur("hasDisabilityId")}
			/>
			<FormField
				id="disabilityValidUntil"
				label={t("health.disability.valid_until")}
				type="date"
				register={register("disabilityValidUntil")}
				onBlur={() => handleFieldBlur("disabilityValidUntil")}
			/>
			<SelectField
				id="merkzeichen"
				label={t("personal.fields.merkzeichen", "Merkzeichen")}
				register={register("merkzeichen")}
				onBlur={() => handleFieldBlur("merkzeichen")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={MERKZEICHEN_OPTIONS.map((code) => ({
					code,
					name: t(`health.marks.${code}`, code),
				}))}
			/>
			<CheckboxField
				id="disabilityApplicationPending"
				label={t(
					"personal.fields.disabilityApplicationPending",
					"Der Antrag auf einen Schwerbehindertenausweis läuft noch",
				)}
				register={register("disabilityApplicationPending")}
				onBlur={() => handleFieldBlur("disabilityApplicationPending")}
			/>
			<CheckboxField
				id="hasCostlyMedicalNutrition"
				label={t(
					"personal.fields.hasCostlyMedicalNutrition",
					"Ich benötige eine kostenaufwändige Ernährung",
				)}
				register={register("hasCostlyMedicalNutrition")}
				onBlur={() => handleFieldBlur("hasCostlyMedicalNutrition")}
			/>
			<CheckboxField
				id="isCareDependent"
				label={t("health.care_dependency.title")}
				register={register("isCareDependent")}
				onBlur={() => handleFieldBlur("isCareDependent")}
			/>
			<CheckboxField
				id="hasInpatientFacilityAccommodation"
				label={t(
					"personal.fields.hasInpatientFacilityAccommodation",
					"Ich lebe in einer stationären Einrichtung",
				)}
				register={register("hasInpatientFacilityAccommodation")}
				onBlur={() => handleFieldBlur("hasInpatientFacilityAccommodation")}
			/>
			<FormField
				id="inpatientFacilityMoveInDate"
				label={t("health.inpatient_details.move_in_date")}
				type="date"
				register={register("inpatientFacilityMoveInDate")}
				onBlur={() => handleFieldBlur("inpatientFacilityMoveInDate")}
			/>
			<FormField
				id="inpatientFacilityLastResidence"
				label={t(
					"personal.fields.inpatientFacilityLastResidence",
					"Letzter Wohnort vor dem Einzug",
				)}
				register={register("inpatientFacilityLastResidence")}
				onBlur={() => handleFieldBlur("inpatientFacilityLastResidence")}
			/>
		</div>
	);
};

export const PersonalDataEdit: React.FC = () => {
	const { t } = useTranslation("profile");
	const navigate = useNavigate();
	const { profileData, updateSection, submitProfile, isUpdating, refetch } =
		useProfile();

	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const activeSavePromise = useRef<Promise<void> | null>(null);
	const hasInitialized = useRef(false);

	const {
		register,
		handleSubmit,
		reset,
		getValues,
		formState: { errors: formErrors, dirtyFields, isSubmitting },
	} = useForm<CombinedWizardFormValues>({
		resolver: zodResolver(
			ProfileEditFormSchema,
		) as unknown as Resolver<CombinedWizardFormValues>,
		mode: "onBlur",
		defaultValues: getProfileFormDefaults(profileData),
	});

	useEffect(() => {
		if (profileData && !hasInitialized.current) {
			reset(getProfileFormDefaults(profileData));
			hasInitialized.current = true;
		}
	}, [profileData, reset]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	const handleFieldBlur = (
		fieldName: keyof CombinedWizardFormValues & string,
	) => {
		if (!dirtyFields[fieldName]) {
			return;
		}

		const value = getValues(fieldName);
		const section = FIELD_SECTION[fieldName] ?? "personalData";
		const data = (
			BANK_FIELDS.has(fieldName)
				? { bankDetails: { [fieldName]: value }, validateEntireForm: false }
				: { [fieldName]: value, validateEntireForm: false }
		) as Partial<Profile[keyof Profile]> & { validateEntireForm?: boolean };

		const savePromise = (async () => {
			try {
				const result = await updateSection({ section, data });

				if (!result.success) {
					setSaveError(result.message || t("personal.errors.update_failed"));
					return;
				}
				setSaveError(null);
				setSaveSuccess(true);
				reset(getValues(), { keepErrors: true });
				setTimeout(() => setSaveSuccess(false), 1500);
			} catch (error) {
				console.error("Failed to auto-save field:", fieldName, error);
				setSaveError(
					t("personal.errors.system_error", "A system error occurred"),
				);
			}
		})();

		activeSavePromise.current = savePromise;
	};

	const onSubmit = async (values: CombinedWizardFormValues) => {
		if (activeSavePromise.current) {
			await activeSavePromise.current;
		}

		try {
			const result = await submitProfile({
				...values,
				validate_entire_form: false,
			});
			if (result?.success) {
				navigate(AppRoutes.Profile, { replace: true });
			} else {
				setSaveError(result?.message || t("personal.errors.update_failed"));
			}
		} catch (error) {
			console.error("Failed to submit profile:", error);
			setSaveError(
				t("personal.errors.system_error", "A system error occurred"),
			);
		}
	};

	const handleSubmitAndClose = (e: React.FormEvent) => {
		void handleSubmit(onSubmit)(e);
	};

	return (
		<PageContainer
			topBarProps={{
				onBack: () => navigate(AppRoutes.Profile),
				showLanguageSwitcher: true,
			}}
		>
			{(isUpdating || saveSuccess) && (
				<div
					role="status"
					className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-white px-5 py-2.5 rounded-full shadow-xl border border-slate-100"
				>
					{isUpdating ? (
						<>
							<Loader2
								className="w-4 h-4 animate-spin text-slate-800"
								aria-hidden="true"
							/>
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saving", "Saving...")}
							</span>
						</>
					) : (
						<>
							<CheckCircle2
								className="w-4 h-4 text-green-600"
								aria-hidden="true"
							/>
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saved", "Saved")}
							</span>
						</>
					)}
				</div>
			)}

			<div className="w-full max-w-md text-center flex flex-col items-center gap-3 mb-6">
				<div className="w-14 h-14 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center">
					<Pencil className="w-6 h-6 text-slate-700" aria-hidden="true" />
				</div>
				<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
					{t("personal.title", "Persönliche Daten")}
				</h1>
			</div>

			{saveError && (
				<div
					role="alert"
					className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm"
				>
					<AlertCircle
						className="w-5 h-5 shrink-0 text-rose-500"
						aria-hidden="true"
					/>
					<p>{saveError}</p>
				</div>
			)}

			<form
				onSubmit={handleSubmitAndClose}
				className="w-full max-w-md flex flex-col gap-6"
			>
				<IdentitySection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<StatusSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<ContactSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<AddressSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<VehicleSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<InsuranceSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<HouseholdSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<HousingSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<FinancialSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>
				<HealthSection
					register={register}
					formErrors={formErrors}
					handleFieldBlur={handleFieldBlur}
					t={t}
				/>

				<div className="pt-6 mt-6 border-t border-slate-200 w-full">
					<PrimaryButton
						data-testid="done-button"
						type="submit"
						disabled={isUpdating || isSubmitting}
						aria-live="polite"
					>
						{isUpdating || isSubmitting
							? t("common.saving", "Speichern...")
							: t("common.save_close", "Speichern und schließen")}
					</PrimaryButton>
				</div>
			</form>
		</PageContainer>
	);
};
