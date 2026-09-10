import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { StepLayout } from "../components/Layout/StepLayout";
import { BenefitAssessmentCard } from "../components/Eligibility/BenefitAssessmentCard";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import { evaluateBenefitCheck } from "../store/benefits/evaluate";
import { BenefitStatus } from "../schemas/benefitCheck.schema";
import { AppRoutes, URL_PARAMS } from "../constants/routes";
import { EXTERNAL_LINKS } from "../config/externalLinks";

/**
 * ProtectedRoute forwards an unauthenticated visitor to Auth and keeps the query string,
 * so this is what makes AuthView run the guest sync. Changing the target silently turns
 * the transfer off.
 */
const CONTINUE_PATH = `${AppRoutes.Profile}?${URL_PARAMS.ORIGIN}=${URL_PARAMS.ORIGIN_ELIGIBILITY}`;

export const EligibilityResult: React.FC = () => {
	const { t } = useTranslation();
	const answers = useBenefitCheckStore((s) => s.answers);
	// Input-side clock only; the engine takes `today` as an argument so it stays testable.
	const today = new Date().toLocaleDateString("sv-SE");
	const result = evaluateBenefitCheck(answers, today);

	const nothingMatches = !result.assessments.some(
		(assessment) =>
			assessment.status === BenefitStatus.LIKELY_YES ||
			assessment.status === BenefitStatus.CHECK_ADVISED,
	);

	return (
		<StepLayout>
			<div className="w-full font-sans flex flex-col gap-6">
				<h1 className="text-h1 font-bold text-brand-black leading-tight">
					{t("result.title")}
				</h1>

				<ul className="flex flex-col gap-3 list-none p-0 m-0">
					{result.assessments.map((assessment) => (
						<BenefitAssessmentCard
							key={assessment.benefit}
							assessment={assessment}
						/>
					))}
				</ul>

				{nothingMatches && (
					<div
						data-testid="result-referral"
						className="rounded-xl border border-brand-border-subtle bg-brand-bg p-4"
					>
						<p className="font-semibold text-brand-black">
							{t("result.referral.title")}
						</p>
						<p className="mt-1 text-base text-brand-grey">
							{t("result.referral.description")}
						</p>
						<a
							href={EXTERNAL_LINKS.SOZIALAMT}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 inline-block text-base font-medium text-primary-blue-400 underline"
						>
							{t("result.referral.link")}
						</a>
					</div>
				)}

				{result.hints.length > 0 && (
					<ul
						data-testid="result-hints"
						className="flex flex-col gap-2 list-none p-0 m-0"
					>
						{result.hints.map((hint) => (
							<li key={hint} className="text-sm text-brand-grey">
								{t(`result.hint.${hint}`)}
							</li>
						))}
					</ul>
				)}

				<Link
					to={CONTINUE_PATH}
					data-testid="result-cta"
					className="w-full rounded-full bg-primary-blue-500 px-6 py-3 text-center font-bold text-white"
				>
					{t("result.cta")}
				</Link>

				<p
					data-testid="result-disclaimer"
					className="text-xs text-brand-grey leading-relaxed"
				>
					{t("result.disclaimer")}
				</p>
			</div>
		</StepLayout>
	);
};
