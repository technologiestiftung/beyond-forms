import React from "react";
import { useTranslation } from "react-i18next";

export interface WelcomeCardProps {
	onQuickAction: (text: string) => void;
	disabled?: boolean;
}

const WELCOME_QUICK_ACTION_KEYS = [
	"welcome.quick_action1",
	"welcome.quick_action2",
	"welcome.quick_action3",
] as const;

export const WelcomeCard: React.FC<WelcomeCardProps> = ({
	onQuickAction,
	disabled = false,
}) => {
	const { t } = useTranslation("chat");

	return (
		<div className="bg-brand-bg rounded-2xl p-6">
			<h3 className="text-[16px] font-bold mb-2">{t("welcome.heading")}</h3>
			<p className="text-[14px] leading-[22px] mb-4">
				{t("welcome.description")}
			</p>
			<div className="flex flex-col gap-2.5">
				{WELCOME_QUICK_ACTION_KEYS.map((key) => {
					const label = t(key);
					return (
						<button
							key={key}
							type="button"
							disabled={disabled}
							onClick={() => onQuickAction(label)}
							className="px-4 py-2 bg-primary-green-500 text-primary-blue-500 rounded-full text-[13px] font-medium text-left cursor-pointer hover:bg-primary-green-500/85 transition-colors w-fit disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{label}
						</button>
					);
				})}
			</div>
		</div>
	);
};
