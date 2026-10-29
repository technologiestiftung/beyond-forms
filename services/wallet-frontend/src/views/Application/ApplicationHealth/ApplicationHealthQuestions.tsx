import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../../hooks/useProfile";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { AppRoutes } from "../../../constants/routes";
import { PageContainer } from "../../../components/Layout/PageContainer";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { OptionCard } from "../../../components/ui/OptionCard";
import { useScrollToTop } from "../../../utils/scroll";
import type {
	AbilityToWorkType,
	DisabilityMerkzeichenType,
	Profile,
} from "../../../schemas/profile.schema";

interface HealthQuestionState {
	isCareDependent?: boolean;
	hasInpatientFacilityAccommodation?: boolean;
	inpatientFacilityMoveInDate?: string;
	inpatientFacilityLastResidence?: string;
	abilityToWork?: AbilityToWorkType;
	reducedWorkCapacityStartDate?: string;
	reducedWorkCapacityEndDate?: string;
	reducedWorkCapacityReason?: string;
	hasDisabilityId?: boolean;
	disabilityValidUntil?: string;
	merkzeichen?: DisabilityMerkzeichenType;
	hasCostlyMedicalNutrition?: boolean;
}

const getNextPage = (current: number, state: HealthQuestionState): number => {
	switch (current) {
		case 1:
			return state.isCareDependent === true ? 2 : 4;
		case 2:
			return state.hasInpatientFacilityAccommodation === true ? 3 : 4;
		case 3:
			return 4;
		case 4:
			if (state.abilityToWork === "Temporarily disabled") {
				return 5;
			}
			if (state.abilityToWork === "Permanently disabled") {
				return 6;
			}
			return 8;
		case 5:
			return 8;
		case 6:
			return state.hasDisabilityId === true ? 7 : 8;
		case 7:
			return 8;
		case 8:
			return -1;
		default:
			return -1;
	}
};

const getPrevPage = (current: number, state: HealthQuestionState): number => {
	switch (current) {
		case 8:
			if (state.abilityToWork === "Temporarily disabled") {
				return 5;
			}
			if (state.abilityToWork === "Permanently disabled") {
				return state.hasDisabilityId === true ? 7 : 6;
			}
			return 4;
		case 7:
			return 6;
		case 6:
			return 4;
		case 5:
			return 4;
		case 4:
			if (state.isCareDependent === true) {
				return state.hasInpatientFacilityAccommodation === true ? 3 : 2;
			}
			return 1;
		case 3:
			return 2;
		case 2:
			return 1;
		case 1:
			return -1;
		default:
			return -1;
	}
};

const hydrateHealthData = (health?: Profile["health"]): HealthQuestionState => {
	if (!health) {
		return {};
	}
	return {
		isCareDependent: health.isCareDependent ?? undefined,
		hasInpatientFacilityAccommodation:
			health.hasInpatientFacilityAccommodation ?? undefined,
		inpatientFacilityMoveInDate: health.inpatientFacilityMoveInDate ?? "",
		inpatientFacilityLastResidence: health.inpatientFacilityLastResidence ?? "",
		abilityToWork: health.abilityToWork ?? undefined,
		reducedWorkCapacityStartDate: health.reducedWorkCapacityStartDate ?? "",
		reducedWorkCapacityEndDate: health.reducedWorkCapacityEndDate ?? "",
		reducedWorkCapacityReason: health.reducedWorkCapacityReason ?? "",
		hasDisabilityId: health.hasDisabilityId ?? undefined,
		disabilityValidUntil: health.disabilityValidUntil ?? "",
		merkzeichen: health.merkzeichen ?? undefined,
		hasCostlyMedicalNutrition: health.hasCostlyMedicalNutrition ?? undefined,
	};
};

export const ApplicationHealthQuestions: React.FC = () => {
	const { t } = useTranslation(["profile", "common"]);
	const navigate = useNavigate();
	const { profileData, updateSection, isUpdating, refetch, isLoading } =
		useProfile();
	const isInitializedRef = useRef(false);

	const [currentPage, setCurrentPage] = useState<number>(1);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// State fields corresponding to schemas/database
	const [isCareDependent, setIsCareDependent] = useState<boolean | undefined>(
		undefined,
	);
	const [
		hasInpatientFacilityAccommodation,
		setHasInpatientFacilityAccommodation,
	] = useState<boolean | undefined>(undefined);
	const [inpatientFacilityMoveInDate, setInpatientFacilityMoveInDate] =
		useState<string>("");
	const [inpatientFacilityLastResidence, setInpatientFacilityLastResidence] =
		useState<string>("");
	const [abilityToWork, setAbilityToWork] = useState<
		AbilityToWorkType | undefined
	>(undefined);
	const [reducedWorkCapacityStartDate, setReducedWorkCapacityStartDate] =
		useState<string>("");
	const [reducedWorkCapacityEndDate, setReducedWorkCapacityEndDate] =
		useState<string>("");
	const [reducedWorkCapacityReason, setReducedWorkCapacityReason] =
		useState<string>("");
	const [hasDisabilityId, setHasDisabilityId] = useState<boolean | undefined>(
		undefined,
	);
	const [disabilityValidUntil, setDisabilityValidUntil] = useState<string>("");
	const [merkzeichen, setMerkzeichen] = useState<
		DisabilityMerkzeichenType | undefined
	>(undefined);
	const [hasCostlyMedicalNutrition, setHasCostlyMedicalNutrition] = useState<
		boolean | undefined
	>(undefined);

	useScrollToTop(currentPage);

	useEffect(() => {
		const init = () => {
			if (profileData?.health && !isInitializedRef.current) {
				const hydrated = hydrateHealthData(profileData.health);
				setIsCareDependent(hydrated.isCareDependent);
				setHasInpatientFacilityAccommodation(
					hydrated.hasInpatientFacilityAccommodation,
				);
				setInpatientFacilityMoveInDate(
					hydrated.inpatientFacilityMoveInDate || "",
				);
				setInpatientFacilityLastResidence(
					hydrated.inpatientFacilityLastResidence || "",
				);
				setAbilityToWork(hydrated.abilityToWork);
				setReducedWorkCapacityStartDate(
					hydrated.reducedWorkCapacityStartDate || "",
				);
				setReducedWorkCapacityEndDate(
					hydrated.reducedWorkCapacityEndDate || "",
				);
				setReducedWorkCapacityReason(hydrated.reducedWorkCapacityReason || "");
				setHasDisabilityId(hydrated.hasDisabilityId);
				setDisabilityValidUntil(hydrated.disabilityValidUntil || "");
				setMerkzeichen(hydrated.merkzeichen);
				setHasCostlyMedicalNutrition(hydrated.hasCostlyMedicalNutrition);
				isInitializedRef.current = true;
			}
		};
		init();
	}, [profileData]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	const saveCurrentPageData = async (): Promise<boolean> => {
		const payload: Partial<HealthQuestionState> & {
			validateEntireForm?: boolean;
		} = {};
		if (currentPage === 1) {
			payload.isCareDependent = isCareDependent;
		} else if (currentPage === 2) {
			payload.hasInpatientFacilityAccommodation =
				hasInpatientFacilityAccommodation;
		} else if (currentPage === 3) {
			payload.inpatientFacilityMoveInDate = inpatientFacilityMoveInDate;
			payload.inpatientFacilityLastResidence = inpatientFacilityLastResidence;
		} else if (currentPage === 4) {
			payload.abilityToWork = abilityToWork;
		} else if (currentPage === 5) {
			payload.reducedWorkCapacityStartDate = reducedWorkCapacityStartDate;
			payload.reducedWorkCapacityEndDate = reducedWorkCapacityEndDate;
			payload.reducedWorkCapacityReason = reducedWorkCapacityReason;
		} else if (currentPage === 6) {
			payload.reducedWorkCapacityStartDate = reducedWorkCapacityStartDate;
			payload.reducedWorkCapacityReason = reducedWorkCapacityReason;
			payload.hasDisabilityId = hasDisabilityId;
		} else if (currentPage === 7) {
			payload.disabilityValidUntil = disabilityValidUntil;
			payload.merkzeichen = merkzeichen || undefined;
		} else if (currentPage === 8) {
			payload.hasCostlyMedicalNutrition = hasCostlyMedicalNutrition;
		}

		payload.validateEntireForm = false;

		try {
			const result = await updateSection({
				section: "health",
				data: payload,
			});
			if (!result.success) {
				setSaveError(result.message || t("errors.save_failed"));
				window.scrollTo({ top: 0, behavior: "smooth" });
				return false;
			}
			setSaveError(null);
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 1500);
			return true;
		} catch (error) {
			console.error("Failed to auto-save health data:", error);
			setSaveError(t("errors.save_failed"));
			window.scrollTo({ top: 0, behavior: "smooth" });
			return false;
		}
	};

	const handleNext = async () => {
		const currentState = {
			isCareDependent,
			hasInpatientFacilityAccommodation,
			inpatientFacilityMoveInDate,
			inpatientFacilityLastResidence,
			abilityToWork,
			reducedWorkCapacityStartDate,
			reducedWorkCapacityEndDate,
			reducedWorkCapacityReason,
			hasDisabilityId,
			disabilityValidUntil,
			merkzeichen,
			hasCostlyMedicalNutrition,
		};
		const next = getNextPage(currentPage, currentState);
		const ok = await saveCurrentPageData();
		if (ok) {
			if (next === -1) {
				navigate(AppRoutes.ApplicationOverview);
			} else {
				setCurrentPage(next);
			}
		}
	};

	const handleBack = () => {
		const currentState = {
			isCareDependent,
			hasInpatientFacilityAccommodation,
			inpatientFacilityMoveInDate,
			inpatientFacilityLastResidence,
			abilityToWork,
			reducedWorkCapacityStartDate,
			reducedWorkCapacityEndDate,
			reducedWorkCapacityReason,
			hasDisabilityId,
			disabilityValidUntil,
			merkzeichen,
			hasCostlyMedicalNutrition,
		};
		const prev = getPrevPage(currentPage, currentState);
		if (prev === -1) {
			navigate(AppRoutes.ApplicationHealthIntro);
		} else {
			setCurrentPage(prev);
		}
	};

	const isNextDisabled = () => {
		if (currentPage === 1) {
			return isCareDependent === undefined;
		}
		if (currentPage === 2) {
			return hasInpatientFacilityAccommodation === undefined;
		}
		if (currentPage === 3) {
			return !inpatientFacilityMoveInDate || !inpatientFacilityLastResidence;
		}
		if (currentPage === 4) {
			return abilityToWork === undefined;
		}
		if (currentPage === 5) {
			return (
				!reducedWorkCapacityStartDate ||
				!reducedWorkCapacityEndDate ||
				!reducedWorkCapacityReason
			);
		}
		if (currentPage === 6) {
			return (
				!reducedWorkCapacityStartDate ||
				!reducedWorkCapacityReason ||
				hasDisabilityId === undefined
			);
		}
		if (currentPage === 7) {
			return !disabilityValidUntil;
		}
		if (currentPage === 8) {
			return hasCostlyMedicalNutrition === undefined;
		}
		return false;
	};

	if (isLoading && !profileData) {
		return (
			<PageContainer topBarProps={{ showLanguageSwitcher: true }}>
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
				className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
			}}
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-16"
		>
			{(isUpdating || saveSuccess) && (
				<div
					role="status"
					className="fixed top-6 z-50 flex items-center gap-2.5 bg-white px-5 py-2.5 rounded-full shadow-xl border border-slate-100 lg:left-[calc(50%+var(--spacing)*36)] lg:-translate-x-1/2"
				>
					{isUpdating ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin text-slate-800" />
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saving")}
							</span>
						</>
					) : (
						<>
							<CheckCircle2 className="w-4 h-4 text-green-600" />
							<span className="text-xs font-bold text-slate-800">
								{t("personal.actions.saved")}
							</span>
						</>
					)}
				</div>
			)}

			{saveError && (
				<div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm lg:max-w-180 lg:mx-auto">
					<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
					<p>{saveError}</p>
				</div>
			)}

			<div className="w-full max-w-md flex flex-col gap-5 lg:max-w-180 lg:mx-auto lg:bg-white lg:rounded-3xl lg:border lg:border-brand-border-subtle lg:shadow-cards lg:px-10 lg:py-8">
				{/* PAGE 1: CARE DEPENDENCY */}
				{currentPage === 1 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.care_dependency.title")}
							</h1>
						</div>
						<div className="bg-brand-bg p-4 rounded-2xl border border-brand-border/40 text-left flex flex-col gap-1.5">
							<p className="text-xs text-brand-grey leading-relaxed font-medium">
								{t("health.care_dependency.desc")}
							</p>
						</div>
						<div className="flex flex-col gap-4">
							<OptionCard
								testIdPrefix="health-option"
								id="care-yes"
								title={t("common.yes")}
								selected={isCareDependent === true}
								onClick={() => setIsCareDependent(true)}
							/>
							<OptionCard
								testIdPrefix="health-option"
								id="care-no"
								title={t("common.no")}
								selected={isCareDependent === false}
								onClick={() => setIsCareDependent(false)}
							/>
						</div>
					</>
				)}

				{/* PAGE 2: INPATIENT ACCOMMODATION */}
				{currentPage === 2 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.inpatient.title")}
							</h1>
						</div>
						<div className="bg-brand-bg p-4 rounded-2xl border border-brand-border/40 text-left flex flex-col gap-1.5">
							<p className="text-xs text-brand-grey leading-relaxed font-medium">
								{t("health.inpatient.desc")}
							</p>
						</div>
						<div className="flex flex-col gap-4">
							<OptionCard
								testIdPrefix="health-option"
								id="inpatient-yes"
								title={t("common.yes")}
								selected={hasInpatientFacilityAccommodation === true}
								onClick={() => setHasInpatientFacilityAccommodation(true)}
							/>
							<OptionCard
								testIdPrefix="health-option"
								id="inpatient-no"
								title={t("common.no")}
								selected={hasInpatientFacilityAccommodation === false}
								onClick={() => setHasInpatientFacilityAccommodation(false)}
							/>
						</div>
					</>
				)}

				{/* PAGE 3: INPATIENT DETAILS */}
				{currentPage === 3 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.inpatient_details.title")}
							</h1>
						</div>
						<div className="flex flex-col gap-4 text-left">
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.inpatient_details.move_in_date")}
								</label>
								<input
									type="date"
									value={inpatientFacilityMoveInDate}
									onChange={(e) =>
										setInpatientFacilityMoveInDate(e.target.value)
									}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.inpatient_details.last_residence")}
								</label>
								<input
									type="text"
									placeholder={t(
										"health.inpatient_details.last_residence_placeholder",
									)}
									value={inpatientFacilityLastResidence}
									onChange={(e) =>
										setInpatientFacilityLastResidence(e.target.value)
									}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
						</div>
					</>
				)}

				{/* PAGE 4: EARNING CAPACITY */}
				{currentPage === 4 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.earning_capacity.title")}
							</h1>
						</div>
						<div className="flex flex-col gap-4">
							<OptionCard
								testIdPrefix="health-option"
								id="work-fully"
								title={t("health.earning_capacity.fully_able")}
								selected={abilityToWork === "Fully able"}
								onClick={() => setAbilityToWork("Fully able")}
							/>
							<OptionCard
								testIdPrefix="health-option"
								id="work-temporary"
								title={t("health.earning_capacity.temporary")}
								selected={abilityToWork === "Temporarily disabled"}
								onClick={() => setAbilityToWork("Temporarily disabled")}
							/>
							<OptionCard
								testIdPrefix="health-option"
								id="work-permanent"
								title={t("health.earning_capacity.permanent")}
								selected={abilityToWork === "Permanently disabled"}
								onClick={() => setAbilityToWork("Permanently disabled")}
							/>
						</div>
					</>
				)}

				{/* PAGE 5: EARNING TEMPORARY DETAILS */}
				{currentPage === 5 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.earning_temp.title")}
							</h1>
						</div>
						<div className="flex flex-col gap-4 text-left">
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.earning_temp.start_date")}
								</label>
								<input
									type="date"
									value={reducedWorkCapacityStartDate}
									onChange={(e) =>
										setReducedWorkCapacityStartDate(e.target.value)
									}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.earning_temp.end_date")}
								</label>
								<input
									type="date"
									value={reducedWorkCapacityEndDate}
									onChange={(e) =>
										setReducedWorkCapacityEndDate(e.target.value)
									}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.earning_temp.reason")}
								</label>
								<input
									type="text"
									placeholder={t("health.earning_temp.reason_placeholder")}
									value={reducedWorkCapacityReason}
									onChange={(e) => setReducedWorkCapacityReason(e.target.value)}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
						</div>
					</>
				)}

				{/* PAGE 6: EARNING PERMANENT DETAILS */}
				{currentPage === 6 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.earning_perm.title")}
							</h1>
						</div>
						<div className="flex flex-col gap-4 text-left">
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.earning_perm.start_date")}
								</label>
								<input
									type="date"
									value={reducedWorkCapacityStartDate}
									onChange={(e) =>
										setReducedWorkCapacityStartDate(e.target.value)
									}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.earning_perm.reason")}
								</label>
								<input
									type="text"
									placeholder={t("health.earning_perm.reason_placeholder")}
									value={reducedWorkCapacityReason}
									onChange={(e) => setReducedWorkCapacityReason(e.target.value)}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
							<div className="flex flex-col gap-4 mt-2">
								<label className="text-sm font-bold text-slate-700">
									{t("health.earning_perm.disability_question")}
								</label>
								<OptionCard
									testIdPrefix="health-option"
									id="disability-yes"
									title={t("common.yes")}
									selected={hasDisabilityId === true}
									onClick={() => setHasDisabilityId(true)}
								/>
								<OptionCard
									testIdPrefix="health-option"
									id="disability-no"
									title={t("common.no")}
									selected={hasDisabilityId === false}
									onClick={() => setHasDisabilityId(false)}
								/>
							</div>
						</div>
					</>
				)}

				{/* PAGE 7: DISABILITY DETAILS */}
				{currentPage === 7 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.disability.title")}
							</h1>
						</div>
						<div className="flex flex-col gap-4 text-left">
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.disability.valid_until")}
								</label>
								<input
									type="date"
									value={disabilityValidUntil}
									onChange={(e) => setDisabilityValidUntil(e.target.value)}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-bold text-slate-700">
									{t("health.disability.merkzeichen")}
								</label>
								<select
									value={merkzeichen || ""}
									onChange={(e) =>
										setMerkzeichen(
											(e.target.value || undefined) as
												| DisabilityMerkzeichenType
												| undefined,
										)
									}
									className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary-blue-300 focus:ring-1 focus:ring-primary-blue-300 outline-none text-slate-800 font-medium transition-all bg-white"
								>
									<option value="">
										{t("health.disability.no_merkzeichen")}
									</option>
									<option value="G">{t("health.marks.G")}</option>
									<option value="aG">{t("health.marks.aG")}</option>
									<option value="H">{t("health.marks.H")}</option>
									<option value="B">{t("health.marks.B")}</option>
									<option value="Bl">{t("health.marks.Bl")}</option>
									<option value="Gl">{t("health.marks.Gl")}</option>
									<option value="TBl">{t("health.marks.TBl")}</option>
									<option value="RF">{t("health.marks.RF")}</option>
									<option value="1 Kl">{t("health.marks.1 Kl")}</option>
									<option value="EB">{t("health.marks.EB")}</option>
									<option value="VB">{t("health.marks.VB")}</option>
									<option value="T">{t("health.marks.T")}</option>
								</select>
							</div>
						</div>
					</>
				)}

				{/* PAGE 8: MEDICAL NUTRITION */}
				{currentPage === 8 && (
					<>
						<div className="text-left flex flex-col gap-3 mb-2 px-1">
							<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
								{t("health.nutrition.title")}
							</h1>
						</div>
						<div className="bg-brand-bg p-4 rounded-2xl border border-brand-border/40 text-left flex flex-col gap-1.5">
							<p className="text-xs text-brand-grey leading-relaxed font-medium">
								{t("health.nutrition.desc")}
							</p>
						</div>
						<div className="flex flex-col gap-4">
							<OptionCard
								testIdPrefix="health-option"
								id="nutrition-yes"
								title={t("common.yes")}
								hinweis={t("health.nutrition.yes_hinweis")}
								selected={hasCostlyMedicalNutrition === true}
								onClick={() => setHasCostlyMedicalNutrition(true)}
							/>
							<OptionCard
								testIdPrefix="health-option"
								id="nutrition-no"
								title={t("common.no")}
								selected={hasCostlyMedicalNutrition === false}
								onClick={() => setHasCostlyMedicalNutrition(false)}
							/>
						</div>
					</>
				)}

				<div className="pt-4 w-full">
					<PrimaryButton
						className="lg:flex lg:w-fit lg:min-w-44 lg:ml-auto"
						data-testid={currentPage === 8 ? "done-button" : "next-button"}
						type="button"
						onClick={handleNext}
						disabled={isNextDisabled()}
					>
						{currentPage === 8 ? t("common.done") : t("common.continue")}
					</PrimaryButton>
				</div>
			</div>
		</PageContainer>
	);
};
