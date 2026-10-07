import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppRoutes, URL_PARAMS } from "../../constants/routes";
import { EXTERNAL_LINKS } from "../../config/externalLinks";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";

const profileFromEligibilityPath = `${AppRoutes.Profile}?${URL_PARAMS.ORIGIN}=${URL_PARAMS.ORIGIN_ELIGIBILITY}`;

const getExternalLink = (key: string): string | null => {
	if (key === "sozialamt") {
		return EXTERNAL_LINKS.SOZIALAMT;
	}
	return null;
};

export interface Outcome {
	translationKey: string;
	isEligible: boolean;
}

export const OutcomeCard: React.FC<Outcome> = ({
	translationKey,
	isEligible,
}) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const externalLink = isEligible ? null : getExternalLink(translationKey);
	const titleId = `outcome-${translationKey}-title`;
	const ctaContent = t(i18nKeys.eligibility.outcomeCTA(translationKey));

	return (
		<article
			aria-labelledby={titleId}
			data-testid="outcome-card"
			className="flex flex-col items-center gap-9 w-full h-full lg:items-start lg:gap-0 lg:bg-white lg:rounded-2xl lg:border lg:border-brand-border-subtle lg:shadow-cards lg:p-10"
		>
			<div className="flex flex-col items-center gap-5 text-start lg:items-start lg:gap-0 lg:w-full">
				<h2
					id={titleId}
					data-testid="outcome-title"
					className="text-h1 font-bold text-brand-black leading-tight lg:text-[2rem] lg:leading-10"
				>
					{t(i18nKeys.eligibility.outcomeTitle(translationKey))}
				</h2>

				<div className="flex flex-col gap-2 lg:mt-6 lg:rounded-xl lg:bg-brand-bg lg:p-5 lg:w-full">
					<h3 className="hidden lg:block text-sm font-semibold uppercase tracking-wider text-primary-blue-500">
						{t(i18nKeys.eligibility.outcomeReasonLabel)}
					</h3>
					<p
						data-testid="outcome-reason"
						className="text-body-lg text-brand-black leading-relaxed lg:max-w-prose"
					>
						{t(i18nKeys.eligibility.outcomeDesc(translationKey))}
					</p>
				</div>
			</div>

			{externalLink ? (
				<a
					href={externalLink}
					target="_blank"
					rel="noopener noreferrer"
					data-testid="outcome-cta"
					className="text-body-lg text-primary-blue-400 font-medium underline decoration-solid hover:text-primary-blue-500 hover:decoration-2 transition-colors cursor-pointer lg:mt-8"
				>
					{ctaContent}
				</a>
			) : (
				<PrimaryButton
					onClick={() => navigate(profileFromEligibilityPath)}
					data-testid="outcome-cta"
					className="lg:w-auto lg:mt-8"
				>
					{ctaContent}
				</PrimaryButton>
			)}
		</article>
	);
};
