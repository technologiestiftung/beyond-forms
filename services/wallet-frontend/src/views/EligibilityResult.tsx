import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { StepLayout } from "../components/Layout/StepLayout";
import { OutcomeList } from "../components/Eligibility/OutcomeList";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";
import { i18nKeys } from "../i18n/i18nKeys";
import { useRootStore } from "../store/useRootStore";
import { useEligibilityOutcome } from "../hooks/useEligibilityOutcome";
import { ResultProfile } from "../schemas/eligibility.schema";

export const EligibilityResult: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { resetAll } = useRootStore();
	const shouldReduceMotion = useReducedMotion();

	const { profile, hasError, translationKey, path } = useEligibilityOutcome();

	if (hasError || !profile) {
		return <Navigate to={AppRoutes.Home} replace />;
	}

	const outcomes = [
		{ translationKey, isEligible: profile === ResultProfile.ELIGIBLE },
	];

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
			width="wide"
		>
			<motion.div
				initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: "easeOut" }}
				className="w-full flex flex-col items-center gap-6 pt-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-6 lg:pt-2"
			>
				<div className="contents lg:flex lg:flex-col lg:gap-3 lg:col-span-2">
					<p className="hidden lg:block text-sm font-semibold uppercase tracking-wider text-primary-blue-500">
						{t(i18nKeys.eligibility.title)}
					</p>
					<h1 className="w-full text-body text-brand-grey lg:text-brand-black lg:text-[2.5rem] lg:leading-12 lg:font-bold">
						{t(i18nKeys.eligibility.resultHeading)}
					</h1>
				</div>

				<OutcomeList outcomes={outcomes} />

				<button
					type="button"
					onClick={handleStartOver}
					className="text-body-lg text-primary-blue-400 font-medium underline decoration-solid hover:text-primary-blue-500 hover:decoration-2 transition-colors cursor-pointer lg:col-start-1 lg:justify-self-start"
				>
					{t(i18nKeys.common.startOver)}
				</button>
			</motion.div>
		</StepLayout>
	);
};
