import React from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";

export const StartOverButton: React.FC<{
	onClick: () => void;
	className?: string;
}> = ({ onClick, className = "" }) => {
	const { t } = useTranslation();

	return (
		<button
			type="button"
			onClick={onClick}
			className={`text-body-lg text-primary-blue-400 font-medium underline decoration-solid hover:text-primary-blue-500 hover:decoration-2 transition-colors cursor-pointer ${className}`}
		>
			{t(i18nKeys.common.startOver)}
		</button>
	);
};
