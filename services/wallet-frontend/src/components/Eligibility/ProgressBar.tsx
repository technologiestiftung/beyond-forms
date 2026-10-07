import React from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { useEligibilityStore } from "../../store/useEligibilityStore";
import { ProgressBar as SharedProgressBar } from "../ui/ProgressBar";

interface ProgressBarProps {
	current: number;
	total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
	const { t } = useTranslation();
	const maxDepthReached = useEligibilityStore((state) => state.maxDepthReached);
	const visualDepth = Math.max(current, maxDepthReached);
	const progressText = t(i18nKeys.eligibility.progressAria, {
		current,
		total,
	});

	return (
		<div className="w-full mb-6 font-sans flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6 lg:px-13">
			<SharedProgressBar
				current={visualDepth}
				total={total}
				colorVariant="blue"
				ariaLabel={progressText}
				className="lg:mb-0"
			/>
			<p className="text-base text-brand-grey lg:shrink-0 lg:font-medium lg:text-primary-blue-500">
				{progressText}
			</p>
		</div>
	);
};
