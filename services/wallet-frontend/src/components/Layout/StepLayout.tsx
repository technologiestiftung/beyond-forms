import React from "react";
import type { LanguageSwitcherVariant } from "../LanguageSwitcher";
import { PageContainer } from "./PageContainer";

interface StepLayoutProps {
	children: React.ReactNode;
	onBack?: () => void;
	showLanguageSwitcher?: boolean;
	colorVariant?: LanguageSwitcherVariant;
	backAriaLabel?: string;
	backTestId?: string;
	contentClassName?: string;
	topBarClassName?: string;
}

/**
 * StepLayout handles the common header and spacing for flow-based pages.
 * It uses PageContainer for structural consistency.
 */
export const StepLayout: React.FC<StepLayoutProps> = ({
	children,
	onBack,
	showLanguageSwitcher = true,
	colorVariant = "default",
	backAriaLabel,
	backTestId = "tutorial-back",
	contentClassName = "",
	topBarClassName = "",
}) => {
	return (
		<PageContainer
			maxWidth="sm"
			contentClassName={`flex flex-col flex-grow ${contentClassName}`}
			topBarProps={{
				onBack,
				showLanguageSwitcher,
				colorVariant,
				backAriaLabel,
				backTestId,
				className: topBarClassName,
			}}
		>
			<div className="w-full flex flex-col items-center flex-grow">
				{children}
			</div>
		</PageContainer>
	);
};
