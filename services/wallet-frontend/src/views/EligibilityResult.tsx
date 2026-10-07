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
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { ResultProfile } from "../schemas/eligibility.schema";
import { useEligibilityStore } from "../store/useEligibilityStore";
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

const OutcomeView: React.FC<{ translationKey: string }> = ({
	translationKey,
}) => {
	const { t } = useTranslation();
	const navigate = useNavigate();

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

			<PrimaryButton
				onClick={() => navigate(profileFromEligibilityPath)}
				data-testid="outcome-cta"
			>
				{t(i18nKeys.eligibility.outcomeCTA(translationKey))}
			</PrimaryButton>
		</div>
	);
};

const BenefitList: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const answers = useEligibilityStore((s) => s.answers);
	const assessments = assessBenefits(answers).sort(
		(a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
	);

	return (
		<div className="flex flex-col gap-6 w-full">
			<h1
				data-testid="outcome-title"
				className="text-h1 font-bold text-brand-black leading-tight"
			>
				{t("outcome.eligible.title")}
			</h1>

			<ul className="flex flex-col gap-4 w-full">
				{assessments.map(({ benefit, status, reason }) => (
					<li
						key={benefit}
						data-testid={`benefit-${benefit.toLowerCase()}`}
						data-status={status}
						className="flex flex-col gap-2 rounded-xl border border-brand-border/40 bg-white p-4"
					>
						<h2 className="text-lg font-bold text-brand-black">
							{t(`outcome.benefits.${benefit}`)}
						</h2>
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
				{isEligible ? (
					<BenefitList />
				) : (
					<OutcomeView translationKey={translationKey} />
				)}

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
