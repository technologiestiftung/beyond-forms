import React from "react";
import { useTranslation } from "react-i18next";
import { StepLayout } from "../components/Layout/StepLayout";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import { evaluateBenefitCheck } from "../store/benefits/evaluate";
import { i18nKeys } from "../i18n/i18nKeys";

/**
 * TEIL C: placeholder. Renders the six assessments raw so the flow can be walked end to
 * end and the engine's output inspected. The designed view — status wording, hints,
 * disclaimer, translated reason codes — is part C's job.
 */
export const EligibilityResult: React.FC = () => {
	const { t } = useTranslation();
	const answers = useBenefitCheckStore((s) => s.answers);
	const today = new Date().toLocaleDateString("sv-SE");
	const result = evaluateBenefitCheck(answers, today);

	return (
		<StepLayout>
			<div className="w-full font-sans flex flex-col gap-6">
				<p
					className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
					role="note"
					data-testid="provisional-notice"
				>
					Vorläufige Ansicht. Die gestaltete Ergebnisseite folgt in Teil C.
				</p>

				<h1 className="text-xl font-bold text-brand-black">
					{t(i18nKeys.eligibility.title)}
				</h1>

				<ul className="flex flex-col gap-4 list-none p-0 m-0">
					{result.assessments.map((assessment) => (
						<li
							key={assessment.benefit}
							data-testid={`assessment-${assessment.benefit}`}
							className="rounded-xl border border-brand-border/40 p-4"
						>
							<p className="font-bold text-brand-black">
								{assessment.benefit}
							</p>
							<p className="text-base text-brand-grey">{assessment.status}</p>
							<p className="text-sm text-brand-grey">
								{assessment.reasons.join(", ")}
							</p>
						</li>
					))}
				</ul>

				{result.hints.length > 0 && (
					<ul
						className="flex flex-col gap-2 list-none p-0 m-0"
						data-testid="hints"
					>
						{result.hints.map((hint) => (
							<li key={hint} className="text-sm text-brand-grey">
								{hint}
							</li>
						))}
					</ul>
				)}
			</div>
		</StepLayout>
	);
};
