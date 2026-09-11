import React, { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Info } from "lucide-react";
import { useProfile } from "../../hooks/useProfile";
import {
	MAX_MILESTONE_LEVEL,
	useProfileStore,
} from "../../store/useProfileStore";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ApplicationCard } from "./ApplicationCard";
import { SimpleApplicationCard } from "./SimpleApplicationCard";
import profileIllustration from "../../assets/illustrations/profile.svg";
import { partitionDashboardCards } from "./dashboardCards";
import type { DashboardCardSpec } from "./dashboardCards";
import { profileToBenefitAnswers } from "../../store/benefits/fromProfile";
import { evaluateBenefitCheck } from "../../store/benefits/evaluate";
import { todayIsoDate } from "../../utils/date";

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
	const { t } = useTranslation("dashboard");

	const {
		profileData,
		milestoneLevel: rawMilestoneLevel,
		isLoading: isProfileLoading,
		isError: isProfileError,
		refetch,
	} = useProfile();

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

	const [showHidden, setShowHidden] = useState(false);
	const hiddenGroupId = useId();

	/**
	 * Which benefits fit is worked out from the profile on every render rather than read
	 * from a stored verdict, so it follows the profile as it changes — someone who corrects
	 * their income or their ability to work sees the dashboard change with it.
	 */
	const { visible, hidden } = useMemo(() => {
		if (!profileData) {
			return partitionDashboardCards(undefined);
		}
		const answers = profileToBenefitAnswers(profileData);
		const { assessments } = evaluateBenefitCheck(answers, todayIsoDate());
		return partitionDashboardCards(assessments);
	}, [profileData]);

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

	if (isProfileLoading) {
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

	const trimmedFirstName = profileData?.personalData?.firstName?.trim() ?? "";

	const greetingHeadline = trimmedFirstName
		? t("onboarding.checklist.greeting_named", { name: trimmedFirstName })
		: t("onboarding.checklist.greeting_anonymous");

	const renderCard = (card: DashboardCardSpec) =>
		card.kind === "guided" ? (
			// ApplicationCard carries its own form type and derives its copy from the
			// milestone, so it cannot go through the generic title/description lookup.
			<ApplicationCard
				key={card.id}
				status={appCardStatus}
				level={milestoneLevel}
			/>
		) : (
			<SimpleApplicationCard
				key={card.id}
				title={t(`sections.applications.${card.id}.title`)}
				description={t(`sections.applications.${card.id}.description`)}
				formType={card.formType as string}
			/>
		);

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

				{visible.map(renderCard)}

				{hidden.length > 0 && (
					<div className="w-full">
						<button
							type="button"
							aria-expanded={showHidden}
							aria-controls={hiddenGroupId}
							onClick={() => setShowHidden((open) => !open)}
							data-testid="dashboard-hidden-toggle"
							className="flex w-full items-center gap-2 py-2 text-left text-sm text-brand-grey"
						>
							<ChevronDown
								aria-hidden
								className={`size-4 shrink-0 transition-transform ${
									showHidden ? "rotate-180" : ""
								}`}
							/>
							{t("sections.applications.hidden_group.count", {
								count: hidden.length,
							})}
						</button>
						{showHidden && (
							<div
								id={hiddenGroupId}
								data-testid="dashboard-hidden-list"
								className="mt-2 flex flex-col gap-6"
							>
								<p className="text-sm text-brand-grey">
									{t("sections.applications.hidden_group.description")}
								</p>
								{hidden.map(renderCard)}
							</div>
						)}
					</div>
				)}

				{/*
				Commented out for now as we don't want to use tutorials yet
				<DashboardTutorials
					tutorials={tutorials}
					activeLanguage={activeLanguage}
				/>*/}

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
