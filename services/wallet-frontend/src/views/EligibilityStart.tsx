import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { StepLayout } from "../components/Layout/StepLayout";
import * as Icons from "../components/ui/Icons";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";
import { i18nKeys } from "../i18n/i18nKeys";

import { useEligibilityStore } from "../store/useEligibilityStore";
import { useAuthStore } from "../store/useAuthStore";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { IntroCarousel } from "../components/Eligibility/IntroCarousel";
import { SecondaryButton } from "../components/ui/SecondaryButton";

export const EligibilityStart: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const resetEligibility = useEligibilityStore((s) => s.resetForm);
	const isAuthenticated = !!useAuthStore((s) => s.token);

	React.useEffect(() => {
		if (isAuthenticated) {
			navigate(AppRoutes.Dashboard);
		} else {
			resetEligibility();
		}
	}, [isAuthenticated, navigate, resetEligibility]);

	const handleGoToCheck = () => {
		navigate(getEligibilityRoute("nationality"));
	};

	const handleGoToLogin = () => {
		navigate(`${AppRoutes.Auth}?mode=login`);
	};

	return (
		<StepLayout>
			{/* Hero Section */}
			<div className="w-full flex flex-col items-center mb-8 font-sans">
				<div className="bg-white rounded-full size-20 shadow-md border border-brand-border/10 flex items-center justify-center mb-6">
					<div className="size-10 text-brand-primary">
						<Icons.CheckCircleIcon className="size-full" />
					</div>
				</div>

				<h1 className="text-brand-black text-h1 font-bold leading-tight w-full">
					{t(i18nKeys.start.title)}
				</h1>
			</div>

			<div className="w-full flex flex-col items-center shadow-sm bg-white rounded-xl mb-8 p-6">
				<p className="text-brand-black text-body-lg leading-relaxed w-full mb-4">
					{t(i18nKeys.start.desc)}
				</p>
				<ul className="text-brand-black text-body-lg leading-relaxed w-full mb-4 ml-2">
					{t(i18nKeys.start.descList)
						.split("\n")
						.map((item: string) => (
							<li key={item} className="list-disc list-inside">
								{item}
							</li>
						))}
				</ul>
				<PrimaryButton onClick={handleGoToCheck} data-testid="start-button">
					{t(i18nKeys.start.cta)}
				</PrimaryButton>
			</div>

			<div
				className="w-full rounded-xl p-6 mb-8 text-left flex flex-col gap-8"
				aria-labelledby="promo-card-heading"
			>
				<div className="flex flex-col gap-4 w-full">
					<h2
						id="promo-card-heading"
						className="text-brand-black text-h1 font-bold w-full"
					>
						{t("start_screen.promo_card.title")}
					</h2>
					<p className="text-brand-black text-base w-full">
						{t("start_screen.promo_card.description")}
					</p>
				</div>
				<SecondaryButton
					onClick={handleGoToLogin}
					data-testid="promo-card-start-button"
				>
					{t("start_screen.promo_card.cta")}
				</SecondaryButton>
			</div>

			<IntroCarousel />
		</StepLayout>
	);
};
