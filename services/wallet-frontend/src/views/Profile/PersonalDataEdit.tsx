import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import type {
	UseFormRegisterReturn,
	UseFormRegister,
	FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProfileEditFormSchema } from "../../schemas/profile.schema";
import type {
	ProfileEditForm,
	PersonalData,
	Address,
	Profile,
} from "../../schemas/profile.schema";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useProfile } from "../../hooks/useProfile";
import { AlertCircle, CheckCircle2, Loader2, Pencil } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { COUNTRY_OPTIONS } from "../../constants/countries";

type CombinedWizardFormValues = ProfileEditForm;

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
	};

	if (!profileData) {
		return base;
	}

	const personal = profileData.personalData || {};
	const addr = profileData.address || {};

	return {
		...base,
		...personal,
		...addr,
		legalGender: personal.legalGender || "Diverse",
		maritalStatus: personal.maritalStatus || "Single",
		state: addr.state || "Berlin",
	};
}

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
		</div>
	);
};

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
		resolver: zodResolver(ProfileEditFormSchema),
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
		const isAddressField = [
			"street",
			"houseNumber",
			"zipCode",
			"city",
			"state",
		].includes(fieldName);
		const partialData = { [fieldName]: value, validateEntireForm: false };

		const savePromise = (async () => {
			try {
				const result = isAddressField
					? await updateSection({
							section: "address",
							data: partialData as Partial<Address>,
						})
					: await updateSection({
							section: "personalData",
							data: partialData as Partial<PersonalData>,
						});

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
				<AddressSection
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
