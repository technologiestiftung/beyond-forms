import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useTutorialStore } from "../../store/useTutorialStore";
import { PageContainer } from "../../components/Layout/PageContainer";
import { AppRoutes } from "../../constants/routes";
import { PrimaryButton } from "../ui/PrimaryButton";
import { resolveLocalizedStepImage } from "../../constants/tutorialImages";
import { DEFAULT_LOCALE } from "../../constants/locale";
import { ONBOARDING_TUTORIAL_SLUGS } from "../../constants/onboardingTutorials";
import type { TutorialResponse, TutorialStep } from "../../schemas/cms.schema";

function pickLocalizedStepContent(
	step: TutorialStep | undefined,
	lang: string,
): { title: string; text: string } | undefined {
	const content = step?.content;
	if (!content) {
		return undefined;
	}
	return content[lang] || content[DEFAULT_LOCALE];
}

function pickLocalizedTutorialTitle(
	tutorial: TutorialResponse,
	lang: string,
): string | undefined {
	return tutorial.title[lang] || tutorial.title[DEFAULT_LOCALE];
}

interface TutorialStepFlowProps {
	tutorial: TutorialResponse;
}

function TutorialStepFlow({ tutorial }: TutorialStepFlowProps) {
	const navigate = useNavigate();
	const { i18n, t } = useTranslation("dashboard");
	const completeTutorial = useTutorialStore((s) => s.completeTutorial);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);

	const activeLanguage = i18n.language || DEFAULT_LOCALE;
	const steps = tutorial.steps;
	const totalSteps = steps.length;
	const stepIndex = Math.min(currentStepIndex, Math.max(0, totalSteps - 1));
	const currentStep = steps[stepIndex];
	const stepLocalization = pickLocalizedStepContent(
		currentStep,
		activeLanguage,
	);
	const tutorialTitle = pickLocalizedTutorialTitle(tutorial, activeLanguage);
	const resolvedStepImgSrc = resolveLocalizedStepImage(
		currentStep.image,
		activeLanguage,
	);

	const isMandatory =
		tutorial.slug === ONBOARDING_TUTORIAL_SLUGS.appGuide &&
		tutorial.progress.status !== "completed";

	const handleNext = async () => {
		if (stepIndex < totalSteps - 1) {
			setCurrentStepIndex(stepIndex + 1);
		} else {
			try {
				await completeTutorial(tutorial.id);
			} catch (err) {
				console.error("Sync failed:", err);
			}
			navigate(AppRoutes.Dashboard, { replace: true });
		}
	};

	const handleBack = () => {
		if (stepIndex > 0) {
			setCurrentStepIndex(stepIndex - 1);
		}
	};

	return (
		<PageContainer
			bgColor="white"
			withPadding={false}
			topBarProps={{
				// Suppress back arrow dynamically on stepIndex 0 for mandatory guides
				onBack: isMandatory && stepIndex === 0 ? undefined : handleBack,
				// Hide Close (X) button completely for mandatory guides
				rightElement: isMandatory ? undefined : (
					<button
						type="button"
						onClick={() => navigate(AppRoutes.Dashboard)}
						aria-label={t("onboarding.tutorial_viewer.close")}
						className="size-11 bg-brand-border-subtle hover:bg-brand-border-subtle/80 rounded-full flex items-center justify-center active:scale-90"
					>
						<X className="w-5 h-5 text-primary-blue-500" aria-hidden />
					</button>
				),
			}}
		>
			<div className="flex bg-white rounded-2xl min-h-full flex-col justify-between w-full px-6 pt-6 pb-12">
				<div className="flex flex-col gap-6">
					<div className="flex flex-col items-start w-full gap-2">
						<span className="text-xs font-semibold">{tutorialTitle}</span>
						<h1 className="text-h1 font-extrabold  leading-snug">
							{stepLocalization?.title || "Schritt"}
						</h1>
						<p className="text-body-lg whitespace-pre-line mt-4">
							{stepLocalization?.text || ""}
						</p>
						{resolvedStepImgSrc && (
							<div className="w-full max-h-[400px] flex items-center justify-center mt-6 overflow-hidden rounded-lg border border-gray-100 bg-gray-50/50 p-2">
								<img
									src={resolvedStepImgSrc}
									className="max-h-full max-w-full object-contain"
									loading="lazy"
									alt={`${stepLocalization?.title} - ${stepIndex + 1}`}
								/>
							</div>
						)}
					</div>
				</div>

				<div className="flex shrink-0 w-full flex-col items-center gap-6 pt-6">
					{steps.length > 1 && (
						<div className="flex items-center space-x-1.5">
							{steps.map((_, idx) => (
								<div
									key={idx}
									className={`h-1.5 rounded-full transition-all ${idx === stepIndex ? "w-4 bg-status-done" : "w-1.5 bg-brand-border"}`}
								/>
							))}
						</div>
					)}

					<PrimaryButton onClick={handleNext}>
						{stepIndex === totalSteps - 1
							? t("onboarding.tutorial_viewer.finish", "Verstanden")
							: t("onboarding.tutorial_viewer.next", "Weiter")}
					</PrimaryButton>
				</div>
			</div>
		</PageContainer>
	);
}

export const TutorialViewer: React.FC = () => {
	const { slug } = useParams<{ slug: string }>();
	const navigate = useNavigate();
	const { t } = useTranslation("dashboard");

	const { tutorials, isLoading, fetchTutorials } = useTutorialStore();
	const [listReady, setListReady] = useState(
		() => useTutorialStore.getState().tutorials.length > 0,
	);

	useEffect(() => {
		if (useTutorialStore.getState().tutorials.length > 0) {
			return;
		}
		void fetchTutorials().finally(() => {
			setListReady(true);
		});
	}, [fetchTutorials]);

	const tutorial = useMemo(
		() => (slug ? tutorials.find((item) => item.slug === slug) : undefined),
		[tutorials, slug],
	);

	useEffect(() => {
		if (!listReady || isLoading) {
			return;
		}
		if (!slug) {
			navigate(AppRoutes.Dashboard, { replace: true });
			return;
		}
		if (!tutorial || tutorial.steps.length === 0) {
			navigate(AppRoutes.Dashboard, { replace: true });
		}
	}, [listReady, isLoading, tutorial, slug, navigate]);

	const showLoading = !listReady || (isLoading && tutorials.length === 0);

	if (showLoading) {
		return (
			<PageContainer withPadding={false}>
				<div className="flex min-h-screen flex-col items-center justify-center w-full px-6">
					<p className="text-brand-black text-body-lg font-medium text-center">
						{t("onboarding.tutorial_viewer.loading")}
					</p>
				</div>
			</PageContainer>
		);
	}

	if (!tutorial || tutorial.steps.length === 0) {
		return null;
	}

	return <TutorialStepFlow key={slug ?? ""} tutorial={tutorial} />;
};
