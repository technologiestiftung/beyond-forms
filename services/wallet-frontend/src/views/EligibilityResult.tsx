import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { StepLayout } from "../components/Layout/StepLayout";
import { OutcomeList } from "../components/Eligibility/OutcomeList";
import {
	AppRoutes,
	URL_PARAMS,
	getEligibilityRoute,
} from "../constants/routes";
import { i18nKeys } from "../i18n/i18nKeys";
import { useRootStore } from "../store/useRootStore";
import { useEligibilityOutcome } from "../hooks/useEligibilityOutcome";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { ResultProfile } from "../schemas/eligibility.schema";
import { useEligibilityStore } from "../store/useEligibilityStore";
import { EligibilityEngine } from "../store/EligibilityEngine";
import {
	BenefitStatus,
	assessBenefits,
	needsResidenceHint,
} from "../store/benefitRules";

const profileFromEligibilityPath = `${AppRoutes.Profile}?${URL_PARAMS.ORIGIN}=${URL_PARAMS.ORIGIN_ELIGIBILITY}`;

const STATUS_ORDER = [
	BenefitStatus.LIKELY,
	BenefitStatus.POSSIBLE,
	BenefitStatus.NO,
];

const STATUS_STYLES: Record<BenefitStatus, string> = {
	[BenefitStatus.LIKELY]: "bg-primary-green-300 text-primary-blue-500",
	[BenefitStatus.POSSIBLE]: "bg-primary-blue-50 text-primary-blue-500",
	[BenefitStatus.NO]: "bg-brand-bg text-brand-black",
};

const BenefitList: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const answers = useEligibilityStore((s) => s.answers);
	const assessments = assessBenefits(
		EligibilityEngine.answersOnValidPath(answers),
	).sort(
		(a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
	);

	return (
		<div className="flex flex-col gap-6 w-full">
			<h2
				data-testid="outcome-title"
				className="text-h1 font-bold text-brand-black leading-tight lg:text-[2rem] lg:leading-10"
			>
				{t("outcome.eligible.title")}
			</h2>

			<ul className="flex flex-col gap-4 w-full">
				{assessments.map(({ benefit, status, reason }) => (
					<li
						key={benefit}
						data-testid={`benefit-${benefit.toLowerCase()}`}
						data-status={status}
						className="flex flex-col gap-2 rounded-xl border border-brand-border/40 bg-white p-4"
					>
						<h3 className="text-lg font-bold text-brand-black">
							{t(`outcome.benefits.${benefit}`)}
						</h3>
						<span
							className={`self-start rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[status]}`}
						>
							{t(`outcome.status.${status}`)}
						</span>
						<p className="text-base text-brand-black">
							{t(`outcome.reasons.${reason}`)}
						</p>
					</li>
				))}
			</ul>

			{needsResidenceHint(answers) && (
				<p className="text-base text-brand-black" data-testid="residence-hint">
					{t("outcome.residence_hint")}
				</p>
			)}

			<p className="text-sm text-brand-grey">{t("outcome.disclaimer")}</p>

			<PrimaryButton
				onClick={() => navigate(profileFromEligibilityPath)}
				data-testid="outcome-cta"
			>
				{t("outcome.eligible.cta")}
			</PrimaryButton>
		</div>
	);
};

export const EligibilityResult: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { resetAll } = useRootStore();
	const shouldReduceMotion = useReducedMotion();

	const { profile, hasError, translationKey, path } = useEligibilityOutcome();

	if (hasError || !profile) {
		return <Navigate to={AppRoutes.Home} replace />;
	}

	const isEligible = profile === ResultProfile.ELIGIBLE;

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

				{isEligible ? (
					<BenefitList />
				) : (
					<OutcomeList outcomes={[{ translationKey, isEligible }]} />
				)}

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
