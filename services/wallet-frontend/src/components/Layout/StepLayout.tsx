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
}) => {
	return (
		<PageContainer
			maxWidth="sm"
			contentClassName="flex flex-col flex-grow"
			topBarProps={{
				onBack,
				showLanguageSwitcher,
				colorVariant,
				backAriaLabel,
				backTestId,
			}}
		>
			<div className="w-full flex flex-col items-center flex-grow">
				{children}
			</div>
		</PageContainer>
	);
};
