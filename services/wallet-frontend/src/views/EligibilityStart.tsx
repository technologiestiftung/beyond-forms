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
		<StepLayout
			topBarClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4"
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-16"
		>
			{/* Hero Section */}
			<div className="w-full flex flex-col items-center lg:flex-row lg:items-center lg:gap-6 mb-8 lg:mb-10 font-sans">
				<div className="bg-white rounded-full size-20 shrink-0 shadow-md border border-brand-border/10 flex items-center justify-center mb-6 lg:mb-0">
					<div className="size-10 text-brand-primary">
						<Icons.CheckCircleIcon className="size-full" />
					</div>
				</div>

				<h1 className="text-brand-black text-h1 lg:text-[40px] lg:leading-12 font-bold leading-tight w-full lg:max-w-[820px]">
					{t(i18nKeys.start.title)}
				</h1>
			</div>

			<div className="w-full flex flex-col lg:grid lg:grid-cols-2 lg:gap-8">
				<div className="w-full h-full flex flex-col items-center lg:items-start shadow-sm lg:shadow-cards bg-white rounded-xl lg:rounded-2xl lg:border lg:border-brand-border-subtle mb-8 lg:mb-0 p-6 lg:p-8">
					<p className="text-brand-black text-body-lg leading-relaxed w-full mb-4">
						{t(i18nKeys.start.desc)}
					</p>
					<ul className="text-brand-black text-body-lg leading-relaxed w-full mb-4 lg:mb-8 ml-2">
						{t(i18nKeys.start.descList)
							.split("\n")
							.map((item: string) => (
								<li key={item} className="list-disc list-inside">
									{item}
								</li>
							))}
					</ul>
					<PrimaryButton
						onClick={handleGoToCheck}
						data-testid="start-button"
						className="lg:w-auto lg:mt-auto"
					>
						{t(i18nKeys.start.cta)}
					</PrimaryButton>
				</div>

				<div
					className="w-full rounded-xl lg:rounded-2xl lg:bg-white lg:shadow-cards lg:border lg:border-brand-border-subtle p-6 lg:p-8 mb-8 lg:mb-0 text-left flex flex-col gap-8 lg:items-start"
					aria-labelledby="promo-card-heading"
				>
					<div className="flex flex-col gap-4 w-full">
						<h2
							id="promo-card-heading"
							className="text-brand-black text-h1 lg:text-h2 font-bold w-full"
						>
							{t("start_screen.promo_card.title")}
						</h2>
						<p className="text-brand-black text-base lg:text-body-lg w-full">
							{t("start_screen.promo_card.description")}
						</p>
					</div>
					<SecondaryButton
						onClick={handleGoToLogin}
						data-testid="promo-card-start-button"
						className="lg:w-auto lg:mt-auto"
					>
						{t("start_screen.promo_card.cta")}
					</SecondaryButton>
				</div>
			</div>

			<div className="w-full lg:mt-12">
				<IntroCarousel />
			</div>
		</StepLayout>
	);
};
