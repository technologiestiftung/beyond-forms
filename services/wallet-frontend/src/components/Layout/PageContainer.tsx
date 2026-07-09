import React from "react";
import { TopBar, type TopBarProps } from "./TopBar";

interface PageContainerProps {
	children: React.ReactNode;
	bgColor?: string;
	maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
	withPadding?: boolean;
	topBarProps?: TopBarProps;
	contentClassName?: string;
}

const MAX_WIDTH_MAP = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	full: "max-w-full",
};

/**
 * PageContainer provides a consistent structural wrapper for all views,
 * enforcing standardized padding, centering, and responsive max-widths.
 */
export const PageContainer: React.FC<PageContainerProps> = ({
	children,
	bgColor = "slate-50",
	maxWidth = "md",
	withPadding = true,
	topBarProps,
	contentClassName = "",
}) => {
	const maxWidthClass = MAX_WIDTH_MAP[maxWidth];

	return (
		<div
			className={`
				w-full min-h-full flex flex-col items-center shrink-0
				${`bg-${bgColor}`}
			`}
		>
			{topBarProps && <TopBar {...topBarProps} />}
			{/* Content is currently alwas padded at the bottom to make sure it scrolls past navbar. */}
			<div
				className={`
				w-full
				pb-32
				${maxWidthClass}
				${withPadding ? "px-6" : ""}
				${withPadding && !topBarProps ? "pt-8" : ""}
				${contentClassName}`}
			>
				{children}
			</div>
		</div>
	);
};
