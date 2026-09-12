import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import type { Resolver, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProfileEditFormSchema } from "../../schemas/profile.schema";
import type { Profile } from "../../schemas/profile.schema";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../hooks/useProfile";
import { AlertCircle, CheckCircle2, Loader2, Pencil } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import type { CombinedWizardFormValues } from "./personalData/types";
import {
	getProfileFormDefaults,
	getSavedProfileFields,
	FIELD_SECTION,
	BANK_FIELDS,
} from "./personalData/formDefaults";
import {
	PROFILE_CATEGORIES,
	getCategoryStatuses,
} from "./personalData/categories";
import { CategoryNavigation } from "./personalData/CategoryNavigation";

export const PersonalDataEdit: React.FC = () => {
	const { t } = useTranslation("profile");
	const navigate = useNavigate();
	const { profileData, updateSection, submitProfile, isUpdating, refetch } =
		useProfile();

	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [activeCategoryId, setActiveCategoryId] = useState(
		PROFILE_CATEGORIES[0].id,
	);

	const activeSavePromise = useRef<Promise<void> | null>(null);
	const hasInitialized = useRef(false);
	const scrollAreaRef = useRef<HTMLDivElement>(null);

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

	// Derived from saved data rather than live form state, so the dots move
	// once a field's blur autosave has round-tripped.
	const categoryStatuses = getCategoryStatuses(
		getSavedProfileFields(profileData),
	);

	const handleCategorySelect = (categoryId: string) => {
		setActiveCategoryId(categoryId);
		// The category that scrolled out of view should not carry its offset over.
		scrollAreaRef.current?.scrollTo({ top: 0 });
	};

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

	/**
	 * Desktop only renders the active category, so an invalid field elsewhere
	 * would otherwise block the submit with nothing on screen. Jump to the
	 * category that owns the first error and focus it.
	 */
	const handleInvalidSubmit = (
		errors: FieldErrors<CombinedWizardFormValues>,
	) => {
		setSaveError(
			t(
				"personal.errors.validation_failed",
				"Bitte prüfe die markierten Angaben.",
			),
		);

		const firstField = Object.keys(errors)[0];
		if (!firstField) {
			return;
		}

		const categoryId = document
			.getElementById(firstField)
			?.closest("[data-profile-category]")
			?.getAttribute("data-profile-category");

		if (categoryId) {
			setActiveCategoryId(categoryId);
		}

		// The field stays hidden until the category switch has rendered.
		requestAnimationFrame(() => document.getElementById(firstField)?.focus());
	};

	const handleSubmitAndClose = (e: React.FormEvent) => {
		void handleSubmit(onSubmit, handleInvalidSubmit)(e);
	};

	return (
		<PageContainer
			topBarProps={{
				onBack: () => navigate(AppRoutes.Profile),
				showLanguageSwitcher: true,
				className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
			}}
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-8 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden"
			className="lg:h-full lg:min-h-0 lg:overflow-hidden"
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

			<div className="w-full max-w-md text-center flex flex-col items-center gap-3 mb-6 lg:max-w-none lg:text-left lg:items-start lg:gap-2 lg:mb-8">
				<div className="w-14 h-14 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center lg:hidden">
					<Pencil className="w-6 h-6 text-slate-700" aria-hidden="true" />
				</div>
				<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight lg:text-[32px] lg:leading-10">
					{t("personal.title", "Persönliche Daten")}
				</h1>
				<p className="hidden lg:block text-base text-brand-grey">
					{t(
						"personal.subtitle",
						"Deine Angaben werden für alle Anträge übernommen. Du kannst sie jederzeit ändern.",
					)}
				</p>
			</div>

			{saveError && (
				<div
					role="alert"
					className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm lg:max-w-none"
				>
					<AlertCircle
						className="w-5 h-5 shrink-0 text-rose-500"
						aria-hidden="true"
					/>
					<p>{saveError}</p>
				</div>
			)}

			<div className="w-full lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8 lg:flex-1 lg:min-h-0">
				<CategoryNavigation
					activeCategoryId={activeCategoryId}
					categoryStatuses={categoryStatuses}
					onSelect={handleCategorySelect}
					t={t}
				/>

				<form
					onSubmit={handleSubmitAndClose}
					className="w-full max-w-md flex flex-col gap-6 lg:max-w-none lg:h-full lg:min-h-0"
				>
					{/*
					Every section stays mounted so autosave and validation keep seeing
					all values. Mobile shows them stacked, desktop reveals only the
					category picked in the sidebar.
					*/}
					<div
						ref={scrollAreaRef}
						className="flex flex-col gap-6 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mx-2 lg:px-2 lg:pt-1 lg:pb-3"
					>
						{PROFILE_CATEGORIES.map(({ id, Section }) => (
							<div
								key={id}
								data-profile-category={id}
								className={id === activeCategoryId ? undefined : "lg:hidden"}
							>
								<Section
									register={register}
									formErrors={formErrors}
									handleFieldBlur={handleFieldBlur}
									t={t}
								/>
							</div>
						))}
					</div>

					<div className="pt-6 mt-6 border-t border-slate-200 w-full lg:mt-0 lg:pt-0 lg:border-t-0 lg:shrink-0 lg:flex lg:items-center lg:gap-4">
						<PrimaryButton
							data-testid="done-button"
							type="submit"
							disabled={isUpdating || isSubmitting}
							aria-live="polite"
							className="lg:w-auto lg:ml-auto"
						>
							{isUpdating || isSubmitting
								? t("common.saving", "Speichern...")
								: t("common.save_close", "Speichern und schließen")}
						</PrimaryButton>
					</div>
				</form>
			</div>
		</PageContainer>
	);
};
