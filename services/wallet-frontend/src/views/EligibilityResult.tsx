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
	type BenefitAssessment,
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

const StartOverButton: React.FC<{
	onClick: () => void;
	className?: string;
}> = ({ onClick, className = "" }) => {
	const { t } = useTranslation();

	return (
		<button
			type="button"
			onClick={onClick}
			className={`text-body-lg text-primary-blue-400 font-medium underline decoration-solid hover:text-primary-blue-500 hover:decoration-2 transition-colors cursor-pointer ${className}`}
		>
			{t(i18nKeys.common.startOver)}
		</button>
	);
};

const ITEM_STYLES = {
	card: {
		item: "lg:gap-3 lg:rounded-2xl lg:border-brand-border-subtle lg:p-8 lg:shadow-cards",
		title: "lg:text-2xl lg:leading-snug",
		badge: "lg:order-first",
		reason: "lg:text-body-lg",
	},
	row: {
		item: "lg:flex-row lg:items-baseline lg:gap-4 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-brand-border-subtle lg:last:border-b-0 lg:bg-transparent lg:px-6 lg:py-4",
		title:
			"lg:w-1/3 lg:shrink-0 lg:text-base lg:font-semibold lg:text-brand-grey",
		badge: "lg:hidden",
		reason: "lg:text-brand-grey",
	},
};

const BenefitItem: React.FC<
	BenefitAssessment & { variant: keyof typeof ITEM_STYLES }
> = ({ benefit, status, reason, variant }) => {
	const { t } = useTranslation();
	const styles = ITEM_STYLES[variant];

	return (
		<li
			data-testid={`benefit-${benefit.toLowerCase()}`}
			data-status={status}
			className={`flex flex-col gap-2 rounded-xl border border-brand-border/40 bg-white p-4 ${styles.item}`}
		>
			<h3 className={`text-lg font-bold text-brand-black ${styles.title}`}>
				{t(`outcome.benefits.${benefit}`)}
			</h3>
			<span
				className={`self-start rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[status]} ${styles.badge}`}
			>
				{t(`outcome.status.${status}`)}
			</span>
			<p className={`text-base text-brand-black ${styles.reason}`}>
				{t(`outcome.reasons.${reason}`)}
			</p>
		</li>
	);
};

const BenefitList: React.FC<{ onStartOver: () => void }> = ({
	onStartOver,
}) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const answers = useEligibilityStore((s) => s.answers);
	const assessments = assessBenefits(
		EligibilityEngine.answersOnValidPath(answers),
	).sort(
		(a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
	);
	const matching = assessments.filter((a) => a.status !== BenefitStatus.NO);
	const notMatching = assessments.filter((a) => a.status === BenefitStatus.NO);

	return (
		<div className="flex flex-col gap-6 w-full lg:col-span-2 lg:gap-8">
			<section className="flex flex-col gap-4 lg:gap-5">
				<h2
					data-testid="outcome-title"
					className="text-h1 font-bold text-brand-black leading-tight lg:text-[2.5rem] lg:leading-12"
				>
					{t("outcome.eligible.title")}
				</h2>

				{matching.length > 0 && (
					<ul className="flex flex-col gap-4 w-full lg:grid lg:grid-cols-2 lg:gap-5">
						{matching.map((assessment) => (
							<BenefitItem
								key={assessment.benefit}
								{...assessment}
								variant="card"
							/>
						))}
					</ul>
				)}
			</section>

			{notMatching.length > 0 && (
				<section className="-mt-2 flex flex-col gap-4 lg:mt-0 lg:gap-3">
					<h2 className="sr-only lg:not-sr-only text-sm font-semibold uppercase tracking-wider text-brand-grey">
						{t(`outcome.status.${BenefitStatus.NO}`)}
					</h2>
					<ul className="flex flex-col gap-4 w-full lg:gap-0 lg:rounded-2xl lg:border lg:border-brand-border-subtle">
						{notMatching.map((assessment) => (
							<BenefitItem
								key={assessment.benefit}
								{...assessment}
								variant="row"
							/>
						))}
					</ul>
				</section>
			)}

			{needsResidenceHint(answers) && (
				<p
					className="text-base text-brand-black lg:text-brand-grey"
					data-testid="residence-hint"
				>
					{t("outcome.residence_hint")}
				</p>
			)}

			<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:rounded-2xl lg:bg-primary-blue-500 lg:px-8 lg:py-6">
				<p className="text-sm text-brand-grey lg:max-w-xl lg:text-white/80">
					{t("outcome.disclaimer")}
				</p>
				<PrimaryButton
					onClick={() => navigate(profileFromEligibilityPath)}
					data-testid="outcome-cta"
					className="lg:w-auto lg:shrink-0 lg:px-8 lg:focus-visible:outline-white"
				>
					{t("outcome.eligible.cta")}
				</PrimaryButton>
			</div>

			<div className="flex justify-center lg:justify-start">
				<StartOverButton onClick={onStartOver} />
			</div>
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
				<h1 className="w-full text-body text-brand-grey lg:col-span-2 lg:-mb-3">
					{t(i18nKeys.eligibility.resultHeading)}
				</h1>

				{isEligible ? (
					<BenefitList onStartOver={handleStartOver} />
				) : (
					<>
						<OutcomeList outcomes={[{ translationKey, isEligible }]} />
						<StartOverButton
							onClick={handleStartOver}
							className="lg:col-start-1 lg:justify-self-start"
						/>
					</>
				)}
			</motion.div>
		</StepLayout>
	);
};
