import React from "react";
import type { LanguageSwitcherVariant } from "../LanguageSwitcher";
import { PageContainer } from "./PageContainer";

const WIDE_TOP_BAR = "lg:max-w-[72rem] lg:px-8 xl:px-16 lg:pt-4";
const WIDE_CONTENT = "lg:max-w-[72rem] lg:px-8 xl:px-16 lg:pb-16";

interface StepLayoutProps {
	children: React.ReactNode;
	onBack?: () => void;
	showLanguageSwitcher?: boolean;
	colorVariant?: LanguageSwitcherVariant;
	backAriaLabel?: string;
	backTestId?: string;
	contentClassName?: string;
	topBarClassName?: string;
	width?: "narrow" | "wide";
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
	width = "narrow",
}) => {
	const isWide = width === "wide";

	return (
		<PageContainer
			maxWidth="sm"
			contentClassName={`flex flex-col flex-grow ${isWide ? WIDE_CONTENT : ""} ${contentClassName}`}
			topBarProps={{
				onBack,
				showLanguageSwitcher,
				colorVariant,
				backAriaLabel,
				backTestId,
				className: `${isWide ? WIDE_TOP_BAR : ""} ${topBarClassName}`,
			}}
		>
			<div className="w-full flex flex-col items-center flex-grow">
				{children}
			</div>
		</PageContainer>
	);
};
