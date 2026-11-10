import React from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import type { BenefitResult } from "@beyond-forms/eligibility-engine";
import { StepLayout } from "../components/Layout/StepLayout";
import { OutcomeList } from "../components/Eligibility/OutcomeList";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import {
	AppRoutes,
	URL_PARAMS,
	getEligibilityRoute,
} from "../constants/routes";
import { i18nKeys } from "../i18n/i18nKeys";
import { getDiscoveryEngine } from "../services/eligibility/discoveryEngine";
import { useDiscoveryStore } from "../store/useDiscoveryStore";
import { useRootStore } from "../store/useRootStore";
import { useDiscoveryLanguage, useDiscoveryMatch } from "../hooks/useDiscovery";
import { BenefitStatus } from "../store/benefitRules";
import { StartOverButton } from "../components/Eligibility/ResultParts";
import { ITEM_STYLES } from "../components/Eligibility/resultItemStyles";

const profileFromEligibilityPath = `${AppRoutes.Profile}?${URL_PARAMS.ORIGIN}=${URL_PARAMS.ORIGIN_ELIGIBILITY}`;

/** Reuses the legacy status copy until POSSIBLE is gone from the translations too */
const STATUS_COPY = {
	eligible: BenefitStatus.LIKELY,
	ineligible: BenefitStatus.NO,
} as const;

const DiscoveryBenefitItem: React.FC<{
	result: BenefitResult;
	label: string;
	variant: keyof typeof ITEM_STYLES;
}> = ({ result, label, variant }) => {
	const { t } = useTranslation();
	const styles = ITEM_STYLES[variant];

	return (
		<li
			data-testid={`benefit-${result.id.toLowerCase()}`}
			data-status={result.status}
			className={`flex flex-col gap-2 rounded-xl border border-brand-border/40 bg-white p-4 ${styles.item}`}
		>
			<h3 className={`text-lg font-bold text-brand-black ${styles.title}`}>
				{label}
			</h3>
			{variant === "row" && (
				<span className="self-start rounded-full bg-brand-bg px-3 py-1 text-sm font-medium text-brand-black lg:hidden">
					{t(`outcome.status.${STATUS_COPY.ineligible}`)}
				</span>
			)}
			<p className={`text-base text-brand-black ${styles.reason}`}>
				{result.reasons[0]?.message}
			</p>
		</li>
	);
};

export const DiscoveryResult: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const lang = useDiscoveryLanguage();
	const { resetAll } = useRootStore();
	const resetDiscovery = useDiscoveryStore((s) => s.reset);
	const answers = useDiscoveryStore((s) => s.answers);
	const history = useDiscoveryStore((s) => s.history);
	const shouldReduceMotion = useReducedMotion();
	const { data: match } = useDiscoveryMatch();

	if (!match) {
		return null;
	}
	if (match.nextQuestion) {
		return <Navigate to={getEligibilityRoute(match.nextQuestion)} replace />;
	}

	const labels = Object.fromEntries(
		getDiscoveryEngine()
			.benefits(lang)
			.map((benefit) => [benefit.id, benefit.label]),
	);
	const matching = match.benefits.filter((b) => b.status === "eligible");
	const notMatching = match.benefits.filter((b) => b.status === "ineligible");
	const livesAbroad = answers.livesInGermany === false;
	const needsResidenceHint =
		answers.citizenship === "citizenship-nonEu" &&
		answers.hasSecureResidenceStatus !== true;

	const handleStartOver = () => {
		resetDiscovery();
		resetAll();
		navigate(AppRoutes.Home);
	};

	const handleBack = () => {
		const last = history[history.length - 1];
		navigate(last ? getEligibilityRoute(last) : AppRoutes.Home);
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

				{livesAbroad ? (
					<>
						<OutcomeList
							outcomes={[{ translationKey: "not_eligible", isEligible: false }]}
						/>
						<StartOverButton
							onClick={handleStartOver}
							className="lg:col-start-1 lg:justify-self-start"
						/>
					</>
				) : (
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
									{matching.map((result) => (
										<DiscoveryBenefitItem
											key={result.id}
											result={result}
											label={labels[result.id]}
											variant="card"
										/>
									))}
								</ul>
							)}
						</section>

						{notMatching.length > 0 && (
							<section className="-mt-2 flex flex-col gap-4 lg:mt-0 lg:gap-3">
								<h2 className="sr-only lg:not-sr-only text-sm font-semibold uppercase tracking-wider text-brand-grey">
									{t(`outcome.status.${STATUS_COPY.ineligible}`)}
								</h2>
								<ul className="flex flex-col gap-4 w-full lg:gap-0 lg:rounded-2xl lg:border lg:border-brand-border-subtle">
									{notMatching.map((result) => (
										<DiscoveryBenefitItem
											key={result.id}
											result={result}
											label={labels[result.id]}
											variant="row"
										/>
									))}
								</ul>
							</section>
						)}

						{needsResidenceHint && (
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
							<StartOverButton onClick={handleStartOver} />
						</div>
					</div>
				)}
			</motion.div>
		</StepLayout>
	);
};
