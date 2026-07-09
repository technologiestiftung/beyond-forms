import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { StepLayout } from "../components/Layout/StepLayout";
import {
	AppRoutes,
	URL_PARAMS,
	getEligibilityRoute,
} from "../constants/routes";
import { i18nKeys } from "../i18n/i18nKeys";
import { useRootStore } from "../store/useRootStore";
import { useEligibilityOutcome } from "../hooks/useEligibilityOutcome";
import { EXTERNAL_LINKS } from "../config/externalLinks";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { ResultProfile } from "../schemas/eligibility.schema";

const profileFromEligibilityPath = `${AppRoutes.Profile}?${URL_PARAMS.ORIGIN}=${URL_PARAMS.ORIGIN_ELIGIBILITY}`;

const getExternalLink = (key: string): string | null => {
	switch (key) {
		case "sozialamt":
			return EXTERNAL_LINKS.SOZIALAMT;
		default:
			return null;
	}
};

const OutcomeView: React.FC<{
	translationKey: string;
	isEligible: boolean;
}> = ({ translationKey, isEligible }) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const externalLink = isEligible ? null : getExternalLink(translationKey);
	const hasExternalLink = !!externalLink;

	const ctaContent = t(i18nKeys.eligibility.outcomeCTA(translationKey));

	return (
		<div className="flex flex-col items-center gap-9 w-full">
			<div className="flex flex-col items-center gap-5 text-start">
				<h1
					data-testid="outcome-title"
					className="text-h1 font-bold text-brand-black leading-tight"
				>
					{t(i18nKeys.eligibility.outcomeTitle(translationKey))}
				</h1>

				<p className="text-body-lg text-brand-black leading-relaxed">
					{t(i18nKeys.eligibility.outcomeDesc(translationKey))}
				</p>
			</div>

			{hasExternalLink ? (
				<a
					href={externalLink}
					target="_blank"
					rel="noopener noreferrer"
					data-testid="outcome-cta"
					className="text-body-lg text-primary-blue-400 font-medium underline decoration-solid hover:text-primary-blue-500 transition-colors cursor-pointer"
				>
					{ctaContent}
				</a>
			) : (
				<PrimaryButton
					onClick={() => navigate(profileFromEligibilityPath)}
					data-testid="outcome-cta"
				>
					{ctaContent}
				</PrimaryButton>
			)}
		</div>
	);
};

export const EligibilityResult: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { resetAll } = useRootStore();
	const shouldReduceMotion = useReducedMotion();

	const { profile, hasError, translationKey, path } = useEligibilityOutcome();
	const isEligible = profile === ResultProfile.ELIGIBLE;

	if (hasError || !profile) {
		return <Navigate to={AppRoutes.Home} replace />;
	}

	const handleStartOver = () => {
		resetAll();
		navigate(AppRoutes.Home);
	};

	const handleBack = () => {
		if (path.length > 1) {
			const lastQuestionId = path[path.length - 2];
			navigate(getEligibilityRoute(lastQuestionId));
		} else {
			navigate(AppRoutes.Home);
		}
	};

	return (
		<StepLayout
			onBack={handleBack}
			backTestId="back-button"
			backAriaLabel={t(i18nKeys.common.back)}
		>
			<motion.div
				initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: "easeOut" }}
				className="w-full flex flex-col items-center gap-6 pt-4"
			>
				<OutcomeView translationKey={translationKey} isEligible={isEligible} />

				<button
					type="button"
					onClick={handleStartOver}
					className="text-body-lg text-primary-blue-400 font-medium underline decoration-solid hover:text-primary-blue-500 transition-colors cursor-pointer"
				>
					{t(i18nKeys.common.startOver)}
				</button>
			</motion.div>
		</StepLayout>
	);
};
