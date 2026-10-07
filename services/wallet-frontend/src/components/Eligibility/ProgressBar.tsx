import React from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { ProgressBar as SharedProgressBar } from "../ui/ProgressBar";

interface ProgressBarProps {
	progress: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
	const { t } = useTranslation();
	const percent = Math.round(progress * 100);

	return (
		<div className="w-full mb-6 font-sans">
			<SharedProgressBar
				current={percent}
				total={100}
				colorVariant="blue"
				ariaLabel={t(i18nKeys.eligibility.progressAria, { percent })}
			/>
		</div>
	);
};
