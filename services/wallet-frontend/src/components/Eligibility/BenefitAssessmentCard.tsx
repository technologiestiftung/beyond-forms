import React from "react";
import { useTranslation } from "react-i18next";
import { BenefitStatus } from "../../schemas/benefitCheck.schema";
import type { BenefitAssessment } from "../../schemas/benefitCheck.schema";
import { CheckCircleIcon } from "../ui/Icons";

interface BenefitAssessmentCardProps {
	assessment: BenefitAssessment;
}

/**
 * Colour is always paired with the status text, never used on its own — otherwise the
 * status is invisible to a screen reader and to colour-blind readers.
 */
const STATUS_TONE: Record<BenefitStatus, string> = {
	[BenefitStatus.LIKELY_YES]: "text-primary-blue-500",
	[BenefitStatus.CHECK_ADVISED]: "text-secondary-orange-500",
	[BenefitStatus.LIKELY_NO]: "text-brand-grey",
	[BenefitStatus.NOT_APPLICABLE]: "text-brand-grey",
};

export const BenefitAssessmentCard: React.FC<BenefitAssessmentCardProps> = ({
	assessment,
}) => {
	const { t } = useTranslation();
	/**
	 * Domain spec §8: a benefit that does not concern this household must not read as a
	 * rejection. It stays visible and legible but recedes.
	 */
	const isMuted = assessment.status === BenefitStatus.NOT_APPLICABLE;

	return (
		<li
			data-testid={`assessment-${assessment.benefit}`}
			data-muted={String(isMuted)}
			className={`w-full rounded-xl border border-brand-border-subtle bg-white p-4 shadow-cards ${
				isMuted ? "opacity-60" : ""
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<p className="text-body-lg font-semibold text-brand-black wrap-break-word">
					{t(`result.benefit.${assessment.benefit}`)}
				</p>
				{assessment.status === BenefitStatus.LIKELY_YES && (
					// CheckCircleIcon takes only className, so the test anchor lives on a
					// wrapper rather than on the icon itself.
					<span data-testid="status-icon" className="shrink-0">
						<CheckCircleIcon className="size-5 text-primary-blue-500" />
					</span>
				)}
			</div>

			<p
				className={`mt-1 text-base font-semibold ${STATUS_TONE[assessment.status]}`}
			>
				{t(`result.status.${assessment.status}`)}
			</p>

			{assessment.reasons.length > 0 && (
				<ul className="mt-2 flex flex-col gap-1 list-none p-0">
					{assessment.reasons.map((reason) => (
						<li key={reason} className="text-sm text-brand-grey">
							{t(`result.reason.${reason}`)}
						</li>
					))}
				</ul>
			)}
		</li>
	);
};
