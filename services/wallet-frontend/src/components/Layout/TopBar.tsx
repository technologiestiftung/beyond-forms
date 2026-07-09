import React from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	LanguageSwitcher,
	type LanguageSwitcherVariant,
} from "../LanguageSwitcher";

export interface TopBarProps {
	onBack?: () => void;
	showLanguageSwitcher?: boolean;
	colorVariant?: LanguageSwitcherVariant | "green";
	backAriaLabel?: string;
	backTestId?: string;
	className?: string;
	middleElement?: React.ReactNode;
	rightElement?: React.ReactNode;
}

/**
 * TopBar provides a unified header with an optional back button, middle element, and language switcher.
 */
export const TopBar: React.FC<TopBarProps> = ({
	onBack,
	showLanguageSwitcher = true,
	colorVariant = "default",
	backAriaLabel,
	backTestId = "topbar-back",
	className = "",
	middleElement,
	rightElement,
}) => {
	const { t } = useTranslation();

	const buttonVariants: Record<string, string> = {
		blue: "bg-brand-border-subtle hover:bg-brand-border text-primary-blue-500",
		green:
			"bg-primary-green-500 hover:bg-primary-green-300 text-brand-black shadow-sm",
		default:
			"bg-white text-brand-black border border-brand-border-subtle shadow-sm",
	};

	const buttonVariantClass =
		buttonVariants[colorVariant] || buttonVariants.default;

	const arrowColorClass =
		colorVariant === "blue" ? "text-primary-blue-500" : "text-brand-black";

	return (
		<header
			className={`w-full flex items-center justify-between min-h-20 gap-2 px-6 ${className}`}
		>
			<div className="flex items-center min-w-10">
				{onBack ? (
					<button
						onClick={onBack}
						data-testid={backTestId}
						className={`size-11 flex items-center justify-center rounded-full transition-colors cursor-pointer ${buttonVariantClass}`}
						aria-label={backAriaLabel || t("back")}
					>
						<ArrowLeft className={`size-6 ${arrowColorClass}`} />
					</button>
				) : (
					<div className="size-10" />
				)}
			</div>

			<div className="flex-1 flex justify-center overflow-hidden">
				{middleElement}
			</div>

			<div className="flex items-center gap-2 shrink-0 min-w-10 justify-end">
				{rightElement}
				{showLanguageSwitcher && (
					<LanguageSwitcher
						variant={colorVariant === "blue" ? "blue" : "default"}
					/>
				)}
			</div>
		</header>
	);
};
