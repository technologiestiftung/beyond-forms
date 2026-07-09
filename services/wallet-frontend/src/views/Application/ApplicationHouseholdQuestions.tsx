/* eslint-disable complexity */
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../hooks/useProfile";
import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	Users,
	Calendar,
	MapPin,
} from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { useScrollToTop, scrollToTop } from "../../utils/scroll";
import type {
	HouseholdData,
	PersonalData,
	Profile,
} from "../../schemas/profile.schema";

interface OptionCardProps {
	id: string;
	title: string;
	hinweis?: string;
	selected: boolean;
	onClick: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({
	id,
	title,
	hinweis,
	selected,
	onClick,
}) => {
	const { t } = useTranslation("common");
	return (
		<button
			type="button"
			onClick={onClick}
			data-testid={`household-option-${id}`}
			className={`w-full p-5 rounded-3xl border text-left flex gap-4 transition-all active:scale-[0.98] ${
				selected
					? "bg-green-50/40 border-green-600 shadow-sm"
					: "bg-white border-slate-200 hover:border-slate-300"
			}`}
		>
			<div className="pt-1 shrink-0">
				<div
					className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
						selected ? "border-green-600" : "border-slate-300"
					}`}
				>
					{selected && (
						<div className="w-3 h-3 bg-green-600 rounded-full animate-scaleUp" />
					)}
				</div>
			</div>
			<div className="flex flex-col gap-1.5">
				<span className="text-base font-bold text-slate-800 leading-snug">
					{title}
				</span>
				{hinweis ? (
					<span className="text-xs font-medium text-slate-500 leading-relaxed">
						<strong className="text-slate-600">{t("note")}: </strong>
						{hinweis}
					</span>
				) : null}
			</div>
		</button>
	);
};

const getSupportOption = (
	hasCustodian?: boolean | null,
	hasGuardian?: boolean | null,
): "custodian" | "guardian" | "none" | "" => {
	if (hasCustodian) {
		return "custodian";
	}
	if (hasGuardian) {
		return "guardian";
	}
	if (hasCustodian === false && hasGuardian === false) {
		return "none";
	}
	return "";
};

const getDisplacedOption = (
	displacedStatus?: string | null,
): "yes" | "no" | "" => {
	if (displacedStatus && displacedStatus !== "none") {
		return "yes";
	}
	if (displacedStatus === "none" || displacedStatus === null) {
		return "no";
	}
	return "";
};

export const ApplicationHouseholdQuestions: React.FC = () => {
	const { t } = useTranslation(["application", "profile", "common"]);
	const navigate = useNavigate();
	const { profileData, updateSection, isUpdating, refetch, isLoading } =
		useProfile();
	const isInitializedRef = useRef(false);
	const prevProfileDataRef = useRef<Profile | null>(null);

	const [currentPage, setCurrentPage] = useState<number>(1);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	// Page 1: Legal Support State
	const [supportOption, setSupportOption] = useState<
		"custodian" | "guardian" | "none" | ""
	>("");

	// Page 2: Displaced Status State
	const [displacedOption, setDisplacedOption] = useState<"yes" | "no" | "">("");
	const [displacedStatus, setDisplacedStatus] = useState<string>("");
	const [displacedIssuedOn, setDisplacedIssuedOn] = useState<string>("");
	const [displacedIssuedBy, setDisplacedIssuedBy] = useState<string>("");

	// Page 3: Insurance State
	const [checkSocial, setCheckSocial] = useState(false);
	const [checkHealth, setCheckHealth] = useState(false);
	const [checkNone, setCheckNone] = useState(false);
	const [socialSecurityType, setSocialSecurityType] = useState<string>("");
	const [healthInsuranceStatus, setHealthInsuranceStatus] =
		useState<string>("");

	// Page 4: Household Members Count State
	const [personsInHouseholdCount, setPersonsInHouseholdCount] =
		useState<number>(1);

	// Page 5: Marital Status State
	const [maritalStatus, setMaritalStatus] = useState<string>("");
	const [marriedSince, setMarriedSince] = useState<string>("");

	useScrollToTop(currentPage);

	const shouldUpdate = (
		localVal: unknown,
		prevServerVal: unknown,
		newServerVal: unknown,
	) => {
		const normLocal =
			localVal === "" || localVal === undefined || localVal === null
				? null
				: localVal;
		const normPrev =
			prevServerVal === "" ||
			prevServerVal === undefined ||
			prevServerVal === null
				? null
				: prevServerVal;
		const normNew =
			newServerVal === "" || newServerVal === undefined || newServerVal === null
				? null
				: newServerVal;

		if (!isInitializedRef.current) {
			return true;
		}
		if (normNew === normPrev) {
			return false;
		}
		if (normLocal === normPrev) {
			return true;
		}
		if (normLocal === normNew) {
			return true;
		}
		return false;
	};

	const syncProfileData = () => {
		if (!profileData) {
			return;
		}

		const personal = profileData.personalData || {};
		const household = profileData.household || {};
		const prev = prevProfileDataRef.current;
		const prevPersonal = (prev?.personalData || {}) as Partial<PersonalData>;
		const prevHousehold = (prev?.household || {}) as Partial<HouseholdData>;

		// Sync Support Option
		const newSupportOption = getSupportOption(
			personal.hasCustodian,
			personal.hasGuardian,
		);
		const prevSupportOption = getSupportOption(
			prevPersonal.hasCustodian,
			prevPersonal.hasGuardian,
		);
		if (shouldUpdate(supportOption, prevSupportOption, newSupportOption)) {
			setSupportOption(newSupportOption);
		}

		// Sync Displaced Status
		const newDisplacedOption = getDisplacedOption(personal.displacedStatus);
		const prevDisplacedOption = getDisplacedOption(
			prevPersonal.displacedStatus,
		);
		if (
			shouldUpdate(displacedOption, prevDisplacedOption, newDisplacedOption)
		) {
			setDisplacedOption(newDisplacedOption);
		}
		if (
			personal.displacedStatus &&
			personal.displacedStatus !== "none" &&
			shouldUpdate(
				displacedStatus,
				prevPersonal.displacedStatus,
				personal.displacedStatus,
			)
		) {
			setDisplacedStatus(personal.displacedStatus);
		}
		if (
			shouldUpdate(
				displacedIssuedOn,
				prevPersonal.displacedIssuedOn,
				personal.displacedIssuedOn,
			)
		) {
			setDisplacedIssuedOn(personal.displacedIssuedOn || "");
		}
		if (
			shouldUpdate(
				displacedIssuedBy,
				prevPersonal.displacedIssuedBy,
				personal.displacedIssuedBy,
			)
		) {
			setDisplacedIssuedBy(personal.displacedIssuedBy || "");
		}

		// Sync Insurance
		const hasSocial = !!(
			personal.socialSecurityType && personal.socialSecurityType !== "None"
		);
		const prevHasSocial = !!(
			prevPersonal.socialSecurityType &&
			prevPersonal.socialSecurityType !== "None"
		);
		if (shouldUpdate(checkSocial, prevHasSocial, hasSocial)) {
			setCheckSocial(hasSocial);
		}

		const hasHealth = !!personal.healthInsuranceStatus;
		const prevHasHealth = !!prevPersonal.healthInsuranceStatus;
		if (shouldUpdate(checkHealth, prevHasHealth, hasHealth)) {
			setCheckHealth(hasHealth);
		}

		const isNone =
			personal.socialSecurityType === "None" && !personal.healthInsuranceStatus;
		const prevIsNone =
			prevPersonal.socialSecurityType === "None" &&
			!prevPersonal.healthInsuranceStatus;
		if (shouldUpdate(checkNone, prevIsNone, isNone)) {
			setCheckNone(isNone);
		}

		if (
			shouldUpdate(
				socialSecurityType,
				prevPersonal.socialSecurityType,
				personal.socialSecurityType,
			)
		) {
			setSocialSecurityType(personal.socialSecurityType || "");
		}
		if (
			shouldUpdate(
				healthInsuranceStatus,
				prevPersonal.healthInsuranceStatus,
				personal.healthInsuranceStatus,
			)
		) {
			setHealthInsuranceStatus(personal.healthInsuranceStatus || "");
		}

		// Sync Household Count
		if (
			shouldUpdate(
				personsInHouseholdCount,
				prevHousehold.personsInHouseholdCount,
				household.personsInHouseholdCount,
			)
		) {
			setPersonsInHouseholdCount(household.personsInHouseholdCount ?? 1);
		}

		// Sync Marital Status
		if (
			shouldUpdate(
				maritalStatus,
				prevHousehold.maritalStatus,
				household.maritalStatus,
			)
		) {
			setMaritalStatus(household.maritalStatus || "");
		}
		if (
			shouldUpdate(
				marriedSince,
				prevHousehold.marriedSince,
				household.marriedSince,
			)
		) {
			setMarriedSince(household.marriedSince || "");
		}

		prevProfileDataRef.current = profileData;
		isInitializedRef.current = true;
	};

	const syncProfileDataRef = useRef(syncProfileData);
	useEffect(() => {
		syncProfileDataRef.current = syncProfileData;
	});

	useEffect(() => {
		if (profileData) {
			const timer = setTimeout(() => {
				syncProfileDataRef.current();
			}, 0);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [profileData]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	const handleValidationErrors = (
		errors?: Array<{ field_path: string; message: string }>,
	) => {
		if (!errors) {
			setFieldErrors({});
			return;
		}
		const mappings: Record<string, string> = {
			persons_in_household_count: "personsInHouseholdCount",
			marital_status: "maritalStatus",
			married_since: "marriedSince",
		};
		const errs: Record<string, string> = {};
		errors.forEach((err) => {
			const mappedKey = mappings[err.field_path] || err.field_path;
			errs[mappedKey] = err.message;
		});
		setFieldErrors(errs);
	};

	const clearErrors = () => {
		setSaveError(null);
		setFieldErrors({});
	};

	const triggerSuccess = () => {
		setSaveSuccess(true);
		setSaveError(null);
		setTimeout(() => setSaveSuccess(false), 1000);
	};

	const savePage1 = async () => {
		clearErrors();
		const hasCustodian = supportOption === "custodian";
		const hasGuardian = supportOption === "guardian";

		try {
			const result = await updateSection({
				section: "personalData",
				data: { hasCustodian, hasGuardian, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(2);
			} else {
				setSaveError(result.message || t("profile:errors.save_failed"));
				scrollToTop("smooth");
			}
		} catch {
			setSaveError(t("profile:errors.save_failed"));
			scrollToTop("smooth");
		}
	};

	const savePage2 = async () => {
		clearErrors();
		let data: Record<string, string | null> = {};

		if (displacedOption === "yes") {
			if (!displacedStatus) {
				setSaveError("Bitte wähle Deinen Vertriebenenstatus aus.");
				return;
			}
			data = {
				displacedStatus,
				displacedIssuedOn: displacedIssuedOn || null,
				displacedIssuedBy: displacedIssuedBy || null,
			};
		} else {
			data = {
				displacedStatus: "none",
				displacedIssuedOn: null,
				displacedIssuedBy: null,
			};
		}

		try {
			const result = await updateSection({
				section: "personalData",
				data: { ...data, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(3);
			} else {
				setSaveError(result.message || t("profile:errors.save_failed"));
				scrollToTop("smooth");
			}
		} catch {
			setSaveError(t("profile:errors.save_failed"));
			scrollToTop("smooth");
		}
	};

	const savePage3 = async () => {
		clearErrors();
		let data: Record<string, string | null> = {};

		if (!checkSocial && !checkHealth && !checkNone) {
			setSaveError("Bitte wähle mindestens eine Option aus.");
			return;
		}

		if (checkNone) {
			data = {
				socialSecurityType: "None",
				healthInsuranceStatus: null,
			};
		} else {
			if (checkSocial && !socialSecurityType) {
				setSaveError("Bitte wähle eine Sozialversicherung aus.");
				return;
			}
			if (checkHealth && !healthInsuranceStatus) {
				setSaveError("Bitte wähle eine Krankenversicherung aus.");
				return;
			}
			data = {
				socialSecurityType: checkSocial ? socialSecurityType : "None",
				healthInsuranceStatus: checkHealth ? healthInsuranceStatus : null,
			};
		}

		try {
			const result = await updateSection({
				section: "personalData",
				data: { ...data, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(4);
			} else {
				setSaveError(result.message || t("profile:errors.save_failed"));
				scrollToTop("smooth");
			}
		} catch {
			setSaveError(t("profile:errors.save_failed"));
			scrollToTop("smooth");
		}
	};

	const savePage4 = async () => {
		clearErrors();
		try {
			const result = await updateSection({
				section: "household",
				data: { personsInHouseholdCount, validateEntireForm: false },
			});
			if (result.success) {
				triggerSuccess();
				setCurrentPage(5);
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
				scrollToTop("smooth");
			}
		} catch {
			setSaveError(t("profile:errors.save_failed"));
			scrollToTop("smooth");
		}
	};

	const savePage5 = async () => {
		clearErrors();
		if (!maritalStatus) {
			setSaveError(t("household.questions.error_select_marital_status"));
			return;
		}
		const payload: Partial<HouseholdData> = {
			maritalStatus: maritalStatus as HouseholdData["maritalStatus"],
		};
		if (maritalStatus === "Married") {
			payload.marriedSince = marriedSince || null;
		} else {
			payload.marriedSince = null;
		}

		try {
			const result = await updateSection({
				section: "household",
				data: { ...payload, validateEntireForm: false },
			});
			if (result.success) {
				navigate(AppRoutes.ApplicationOverview);
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
				scrollToTop("smooth");
			}
		} catch {
			setSaveError(t("profile:errors.save_failed"));
			scrollToTop("smooth");
		}
	};

	const handleBack = () => {
		if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
			setSaveError(null);
		} else {
			navigate(AppRoutes.ApplicationHouseholdIntro);
		}
	};

	if (isLoading && !profileData) {
		return (
			<PageContainer>
				<div className="flex items-center justify-center min-h-[50vh]">
					<Loader2 className="w-8 h-8 animate-spin text-slate-500" />
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{
				onBack: handleBack,
				showLanguageSwitcher: true,
			}}
		>
			{(isUpdating || saveSuccess) && (
				<div
					role="status"
					className="fixed top-6 z-50 flex items-center gap-2.5 bg-white px-5 py-2.5 rounded-full shadow-xl border border-slate-100 animate-in fade-in duration-300"
				>
					{isUpdating ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin text-slate-800" />
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saving", "Speichern...")}
							</span>
						</>
					) : (
						<>
							<CheckCircle2 className="w-4 h-4 text-green-600" />
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saved", "Gespeichert")}
							</span>
						</>
					)}
				</div>
			)}

			{saveError && (
				<div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm mx-auto text-left shadow-sm">
					<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
					<p>{saveError}</p>
				</div>
			)}

			<div className="w-full max-w-md flex flex-col gap-6 mx-auto">
				{/* Step Progress Badge */}
				<div className="text-left">
					<span className="text-xs font-semibold text-brand-grey mb-1 block">
						{t("household.steps.step_x_of_y", {
							current: currentPage,
							total: 5,
						})}
					</span>
				</div>

				{/* Page 1: Legal Support */}
				{currentPage === 1 && (
					<div className="flex flex-col gap-5 text-left animate-in slide-in-from-right duration-300">
						<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
							{t("personal.questions.support_title")}
						</h1>

						<div className="flex flex-col gap-3">
							<OptionCard
								id="custodian"
								title={t("personal.options.custodian")}
								selected={supportOption === "custodian"}
								onClick={() => {
									setSupportOption("custodian");
									setSaveError(null);
								}}
							/>
							<OptionCard
								id="guardian"
								title={t("personal.options.guardian")}
								selected={supportOption === "guardian"}
								onClick={() => {
									setSupportOption("guardian");
									setSaveError(null);
								}}
							/>
							<OptionCard
								id="none"
								title={t("personal.options.none")}
								selected={supportOption === "none"}
								onClick={() => {
									setSupportOption("none");
									setSaveError(null);
								}}
							/>
						</div>

						<div className="mt-2 animate-in fade-in duration-300">
							<PrimaryButton
								type="button"
								onClick={savePage1}
								disabled={!supportOption}
							>
								{t("common:next")}
							</PrimaryButton>
						</div>
					</div>
				)}

				{/* Page 2: Displaced Status */}
				{currentPage === 2 && (
					<div className="flex flex-col gap-5 text-left animate-in slide-in-from-right duration-300">
						<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
							{t("personal.questions.displaced_title")}
						</h1>

						<div className="flex flex-col gap-3">
							<OptionCard
								id="yes"
								title={t("personal.options.yes")}
								selected={displacedOption === "yes"}
								onClick={() => {
									setDisplacedOption("yes");
									setSaveError(null);
								}}
							/>
							{displacedOption === "yes" && (
								<div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 p-5 rounded-3xl animate-in slide-in-from-top-3 duration-300 shadow-inner">
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5">
											{t("personal.labels.displaced_status")}
										</label>
										<div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
											<select
												value={displacedStatus}
												onChange={(e) => setDisplacedStatus(e.target.value)}
												className="w-full text-base font-semibold text-slate-800 outline-none bg-transparent"
											>
												<option value="">
													{t("personal.dropdowns.select_status")}
												</option>
												<option value="Expellee (Resettler)">
													{t("personal.options.displaced_expellee")}
												</option>
												<option value="Displaced Person (Resettler)">
													{t("personal.options.displaced_person")}
												</option>
												<option value="Late Resettler">
													{t("personal.options.displaced_late_resettler")}
												</option>
												<option value="Soviet Zone Refugee">
													{t("personal.options.displaced_refugee")}
												</option>
											</select>
										</div>
									</div>

									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5">
											{t("personal.labels.displaced_since")}
										</label>
										<div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
											<Calendar className="text-slate-400 w-5 h-5 shrink-0" />
											<input
												type="date"
												value={displacedIssuedOn}
												onChange={(e) => setDisplacedIssuedOn(e.target.value)}
												className="w-full text-base font-semibold text-slate-800 outline-none"
											/>
										</div>
									</div>

									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5">
											{t("personal.labels.displaced_authority")}
										</label>
										<div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm focus-within:border-primary-blue-300">
											<MapPin className="text-slate-400 w-5 h-5 shrink-0" />
											<input
												type="text"
												placeholder={t("personal.placeholders.authority")}
												value={displacedIssuedBy}
												onChange={(e) => setDisplacedIssuedBy(e.target.value)}
												className="w-full text-base font-semibold text-slate-800 placeholder-slate-400 outline-none"
											/>
										</div>
									</div>
								</div>
							)}
							<OptionCard
								id="no"
								title={t("personal.options.no")}
								selected={displacedOption === "no"}
								onClick={() => {
									setDisplacedOption("no");
									setSaveError(null);
								}}
							/>
						</div>

						<div className="mt-2 animate-in fade-in duration-300">
							<PrimaryButton
								type="button"
								onClick={savePage2}
								disabled={
									!displacedOption ||
									(displacedOption === "yes" &&
										(!displacedStatus ||
											!displacedIssuedOn ||
											!displacedIssuedBy))
								}
							>
								{t("common:next")}
							</PrimaryButton>
						</div>
					</div>
				)}

				{/* Page 3: Insurance */}
				{currentPage === 3 && (
					<div className="flex flex-col gap-5 text-left animate-in slide-in-from-right duration-300 pb-10">
						<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
							{t("personal.questions.insurance_title")}
						</h1>
						<p className="text-slate-600 text-sm leading-relaxed -mt-1 font-medium">
							{t("personal.questions.insurance_subtitle")}
						</p>

						<div className="flex flex-col gap-3">
							<OptionCard
								id="social"
								title={t("personal.options.social")}
								selected={checkSocial}
								onClick={() => {
									setCheckSocial(!checkSocial);
									if (checkNone) {
										setCheckNone(false);
									}
								}}
							/>
							{checkSocial && (
								<div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 p-5 rounded-3xl animate-in slide-in-from-top-3 duration-300 shadow-inner">
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5">
											{t("personal.labels.insurance_provider")}
										</label>
										<div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
											<select
												value={socialSecurityType}
												onChange={(e) => setSocialSecurityType(e.target.value)}
												className="w-full text-base font-semibold text-slate-800 outline-none bg-transparent"
											>
												<option value="">
													{t("personal.dropdowns.select_insurance")}
												</option>
												<option value="Statutory">
													{t("personal.options.insurance_statutory")}
												</option>
												<option value="Private">
													{t("personal.options.insurance_private")}
												</option>
												<option value="Other">
													{t("personal.options.insurance_other")}
												</option>
											</select>
										</div>
									</div>
								</div>
							)}

							<OptionCard
								id="health"
								title={t("personal.options.health")}
								selected={checkHealth}
								onClick={() => {
									setCheckHealth(!checkHealth);
									if (checkNone) {
										setCheckNone(false);
									}
								}}
							/>
							{checkHealth && (
								<div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 p-5 rounded-3xl animate-in slide-in-from-top-3 duration-300 shadow-inner">
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5">
											{t("personal.labels.insurance_status")}
										</label>
										<div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
											<select
												value={healthInsuranceStatus}
												onChange={(e) =>
													setHealthInsuranceStatus(e.target.value)
												}
												className="w-full text-base font-semibold text-slate-800 outline-none bg-transparent"
											>
												<option value="">
													{t("personal.dropdowns.select_status")}
												</option>
												<option value="Family">
													{t("personal.options.status_family")}
												</option>
												<option value="Student">
													{t("personal.options.status_student")}
												</option>
												<option value="Pensioner">
													{t("personal.options.status_pensioner")}
												</option>
												<option value="Employee">
													{t("personal.options.status_employee")}
												</option>
												<option value="Voluntary">
													{t("personal.options.status_voluntary")}
												</option>
												<option value="Other">
													{t("personal.options.status_other")}
												</option>
											</select>
										</div>
									</div>
								</div>
							)}

							<OptionCard
								id="none"
								title={t("personal.options.not_insured")}
								selected={checkNone}
								onClick={() => {
									setCheckNone(!checkNone);
									if (!checkNone) {
										setCheckSocial(false);
										setCheckHealth(false);
										setSocialSecurityType("");
										setHealthInsuranceStatus("");
									}
								}}
							/>
						</div>

						<div className="mt-4 animate-in fade-in duration-300">
							<PrimaryButton
								type="button"
								onClick={savePage3}
								disabled={
									isUpdating ||
									(!checkSocial && !checkHealth && !checkNone) ||
									(checkSocial && !socialSecurityType) ||
									(checkHealth && !healthInsuranceStatus)
								}
							>
								{isUpdating ? (
									<Loader2 className="w-5 h-5 animate-spin mx-auto" />
								) : (
									t("common:save_next")
								)}
							</PrimaryButton>
						</div>
					</div>
				)}

				{/* Page 4: Household Members count */}
				{currentPage === 4 && (
					<div className="flex flex-col gap-5 text-left">
						<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
							{t("household.questions.members_title")}
						</h1>

						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<div
									className={`flex items-center gap-3 bg-white p-4 rounded-2xl border ${fieldErrors.personsInHouseholdCount ? "border-rose-500 bg-rose-50/10" : "border-slate-200"} shadow-sm focus-within:border-primary-blue-300`}
								>
									<Users className="text-brand-grey w-5 h-5 shrink-0" />
									<input
										type="number"
										min="1"
										aria-labelledby="household-count-heading"
										value={personsInHouseholdCount}
										onChange={(e) => {
											setPersonsInHouseholdCount(
												Math.max(1, parseInt(e.target.value) || 1),
											);
											if (fieldErrors.personsInHouseholdCount) {
												setFieldErrors((prev) => {
													const copy = { ...prev };
													delete copy.personsInHouseholdCount;
													return copy;
												});
											}
										}}
										className="w-full text-base font-semibold text-slate-800 placeholder:text-brand-grey outline-none"
									/>
								</div>
								{fieldErrors.personsInHouseholdCount && (
									<p className="text-xs font-semibold text-rose-600 px-1">
										{fieldErrors.personsInHouseholdCount}
									</p>
								)}
							</div>
						</div>

						<PrimaryButton type="button" onClick={savePage4}>
							{t("common:next")}
						</PrimaryButton>
					</div>
				)}

				{/* Page 5: Marital status */}
				{currentPage === 5 && (
					<div className="flex flex-col gap-5 text-left animate-in slide-in-from-right duration-300">
						<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
							{t("household.questions.marital_status_title")}
						</h1>

						<div className="flex flex-col gap-3">
							<OptionCard
								id="Single"
								title={t("household.options.single")}
								selected={maritalStatus === "Single"}
								onClick={() => {
									setMaritalStatus("Single");
									setSaveError(null);
								}}
							/>
							<OptionCard
								id="Married"
								title={t("household.options.married")}
								selected={maritalStatus === "Married"}
								onClick={() => {
									setMaritalStatus("Married");
									setSaveError(null);
								}}
							/>
							{maritalStatus === "Married" && (
								<div className="flex flex-col gap-1.5 bg-slate-50 border border-slate-200 p-4 rounded-3xl animate-in slide-in-from-top-2 duration-300 shadow-inner">
									<label
										htmlFor="married-since"
										className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5 mb-0.5"
									>
										{t("household.questions.married_since_label")}
									</label>
									<div
										className={`flex items-center gap-3 bg-white p-4 rounded-2xl border ${fieldErrors.marriedSince ? "border-rose-500 bg-rose-50/10" : "border-slate-200"} shadow-sm`}
									>
										<Calendar className="text-brand-grey w-5 h-5 shrink-0" />
										<input
											id="married-since"
											type="date"
											value={marriedSince}
											onChange={(e) => {
												setMarriedSince(e.target.value);
												if (fieldErrors.marriedSince) {
													setFieldErrors((prev) => {
														const copy = { ...prev };
														delete copy.marriedSince;
														return copy;
													});
												}
											}}
											className="w-full text-base font-semibold text-slate-800 outline-none"
										/>
									</div>
									{fieldErrors.marriedSince && (
										<p className="text-xs font-semibold text-rose-600 px-1 mt-1">
											{fieldErrors.marriedSince}
										</p>
									)}
								</div>
							)}
							<OptionCard
								id="Divorced"
								title={t("household.options.divorced")}
								selected={maritalStatus === "Divorced"}
								onClick={() => {
									setMaritalStatus("Divorced");
									setSaveError(null);
								}}
							/>
							<OptionCard
								id="Widowed"
								title={t("household.options.widowed")}
								selected={maritalStatus === "Widowed"}
								onClick={() => {
									setMaritalStatus("Widowed");
									setSaveError(null);
								}}
							/>
							<OptionCard
								id="RegisteredPartnership"
								title={t("household.options.partnership")}
								selected={maritalStatus === "Registered Civil Partnership"}
								onClick={() => {
									setMaritalStatus("Registered Civil Partnership");
									setSaveError(null);
								}}
							/>
						</div>

						<div className="mt-2">
							<PrimaryButton type="button" onClick={savePage5}>
								{t("household.actions.finish")}
							</PrimaryButton>
						</div>
					</div>
				)}
			</div>
		</PageContainer>
	);
};
