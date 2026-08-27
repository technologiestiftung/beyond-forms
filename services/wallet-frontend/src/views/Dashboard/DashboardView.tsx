import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { useProfile } from "../../hooks/useProfile";
import {
	MAX_MILESTONE_LEVEL,
	useProfileStore,
} from "../../store/useProfileStore";
import { useTutorialStore } from "../../store/useTutorialStore";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ApplicationCard } from "./ApplicationCard";
import { SimpleApplicationCard } from "./SimpleApplicationCard";
import profileIllustration from "../../assets/illustrations/profile.svg";
import { DEFAULT_LOCALE } from "../../constants/locale";
import { DashboardTutorials } from "./DashboardTutorials";

function applicationCardStatusForMilestone(
	milestoneLevel?: number,
): "not_started" | "in_progress" | "completed" {
	if (!milestoneLevel || milestoneLevel === 0) {
		return "not_started";
	}
	if (milestoneLevel === MAX_MILESTONE_LEVEL) {
		return "completed";
	}
	return "in_progress";
}

export const DashboardView: React.FC = () => {
	const { i18n, t } = useTranslation("dashboard");

	const {
		profileData,
		milestoneLevel: rawMilestoneLevel,
		isLoading: isProfileLoading,
		isError: isProfileError,
		refetch,
	} = useProfile();
	const {
		tutorials,
		isLoading: isTutorialsLoading,
		fetchTutorials,
	} = useTutorialStore();

	useEffect(() => {
		void fetchTutorials();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const [hasCompletedOnboarding] = React.useState(() => {
		if (typeof window === "undefined") {
			return false;
		}
		return (
			window.sessionStorage?.getItem("beyond-forms-wallet-session") !== null ||
			window.localStorage?.getItem("beyond-forms-wallet-session") !== null
		);
	});

	const setMilestoneLevel = useProfileStore((s) => s.setMilestoneLevel);

	const milestoneLevel =
		rawMilestoneLevel === 0 && (hasCompletedOnboarding || !!profileData)
			? 1
			: rawMilestoneLevel;
	const appCardStatus = applicationCardStatusForMilestone(milestoneLevel);

	useEffect(() => {
		if (milestoneLevel !== undefined) {
			setMilestoneLevel(milestoneLevel as 0 | 1 | 2 | 3);
		}
	}, [milestoneLevel, setMilestoneLevel]);

	if (isProfileLoading || isTutorialsLoading) {
		return <DashboardSkeleton />;
	}

	if (isProfileError) {
		return (
			<PageContainer bgColor="brand-bg">
				<div className="flex flex-col items-center justify-center gap-6 max-w-md mx-auto pt-20 text-center">
					<div className="size-16 bg-red-50 rounded-full flex items-center justify-center">
						<Info className="size-8 text-red-600" aria-hidden />
					</div>
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-bold text-brand-carbon">
							{t("load_error.title")}
						</h1>
						<p className="text-brand-black">{t("load_error.description")}</p>
					</div>
					<PrimaryButton onClick={() => void refetch()}>
						{t("load_error.retry")}
					</PrimaryButton>
				</div>
			</PageContainer>
		);
	}

	const activeLanguage = i18n.language || DEFAULT_LOCALE;
	const trimmedFirstName = profileData?.personalData?.firstName?.trim() ?? "";

	const greetingHeadline = trimmedFirstName
		? t("onboarding.checklist.greeting_named", { name: trimmedFirstName })
		: t("onboarding.checklist.greeting_anonymous");

	return (
		<PageContainer
			bgColor="brand-bg"
			topBarProps={{ showLanguageSwitcher: true }}
		>
			<div className="flex flex-col items-start max-w-md w-full min-w-0 gap-6">
				<div className="flex flex-col items-start gap-4 w-full min-w-0">
					<div className="flex flex-row items-center gap-4 w-full min-w-0">
						<img
							src={profileIllustration}
							alt=""
							className="size-11 shrink-0 rounded-full bg-white"
							aria-hidden
						/>
						<h1 className="text-h1 font-bold text-brand-black min-w-0 wrap-break-word">
							{greetingHeadline}
						</h1>
					</div>

					<p className="text-brand-black text-body-lg wrap-break-word">
						{t("onboarding.checklist.intro")}
					</p>
				</div>

				<ApplicationCard status={appCardStatus} level={milestoneLevel} />

				<SimpleApplicationCard
					title={t(
						"sections.applications.parking_permit.title",
						"Bewohnerparkausweis",
					)}
					description={t(
						"sections.applications.parking_permit.description",
						"Beantrage Deinen Bewohnerparkausweis direkt mit Deinen hinterlegten Angaben.",
					)}
					formType="antrag_bewohnerparkausweis"
				/>

				<SimpleApplicationCard
					title={t(
						"sections.applications.housing_allowance.title",
						"Wohngeld",
					)}
					description={t(
						"sections.applications.housing_allowance.description",
						"Beantrage Wohngeld für Deine Miete direkt mit Deinen hinterlegten Angaben.",
					)}
					formType="antrag_wohngeld"
				/>

				<DashboardTutorials
					tutorials={tutorials}
					activeLanguage={activeLanguage}
				/>

				{/*
				Commented out for now as we don't have an emergency info panel yet
				<div className="flex items-start gap-1 text-brand-black text-xs underline max-w-xs min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 wrap-break-word">
					<span>{t("onboarding.checklist.emergency_help")}</span>
					<Info className="w-3.5 h-3.5 shrink-0 text-brand-black" aria-hidden />
				</div> */}
			</div>
		</PageContainer>
	);
};
