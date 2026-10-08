import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AppRoutes } from "../../../constants/routes";
import { i18nKeys } from "../../../i18n/i18nKeys";
import { ResultProfile } from "../../../schemas/eligibility.schema";
import { EligibilityEngine } from "../../../store/EligibilityEngine";
import { useEligibilityStore } from "../../../store/useEligibilityStore";
import { BenefitStatus, assessBenefits } from "../../../store/benefitRules";
import { ChatCard } from "./ChatCard";

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

export const ResultCard: React.FC = () => {
	const { t } = useTranslation();
	const { t: tChat } = useTranslation("chat");
	const answers = useEligibilityStore((s) => s.answers);
	const profile = EligibilityEngine.getOutcomeProfile(
		EligibilityEngine.getValidPath(answers),
	);

	if (profile === ResultProfile.NOT_ELIGIBLE) {
		return (
			<ChatCard testId="guided-result-card">
				<h3 className="text-[16px] font-bold text-brand-black">
					{t(i18nKeys.eligibility.outcomeTitle("not_eligible"))}
				</h3>
				<p className="text-[14px]">
					{t(i18nKeys.eligibility.outcomeDesc("not_eligible"))}
				</p>
			</ChatCard>
		);
	}

	const assessments = [...assessBenefits(answers)].sort(
		(a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
	);

	return (
		<ChatCard testId="guided-result-card">
			<h3 className="text-[16px] font-bold text-brand-black">
				{t(i18nKeys.eligibility.outcomeTitle("eligible"))}
			</h3>
			<ul className="flex flex-col gap-3">
				{assessments.map(({ benefit, status, reason }) => (
					<li key={benefit} className="flex flex-col gap-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-[14px] font-semibold">
								{t(`outcome.benefits.${benefit}`)}
							</span>
							<span
								className={`rounded-full px-2 py-0.5 text-[12px] ${STATUS_STYLES[status]}`}
							>
								{t(`outcome.status.${status}`)}
							</span>
						</div>
						<p className="text-[13px] text-brand-grey">
							{t(`outcome.reasons.${reason}`)}
						</p>
					</li>
				))}
			</ul>
			<Link
				to={AppRoutes.EligibilityResult}
				className="w-fit text-[14px] text-primary-blue-400 underline"
			>
				{tChat("guided.result.details")}
			</Link>
		</ChatCard>
	);
};
