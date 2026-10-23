import React from "react";

const TONES = {
	neutral: {
		pillClass: "border-slate-300 bg-slate-50 text-slate-600",
		dotClass: "bg-slate-300",
	},
	warning: {
		pillClass:
			"border-secondary-orange-500 bg-secondary-orange-20 text-secondary-orange-800",
		dotClass: "bg-secondary-orange-500",
	},
	success: {
		pillClass: "border-green-600 bg-green-50 text-green-700",
		dotClass: "bg-green-600",
	},
} as const;

const SIZES = {
	md: {
		pillClass: "gap-2 px-3 py-1 text-sm",
		dotClass: "size-2",
	},
	compact: {
		pillClass:
			"gap-1.5 px-2.5 py-0.5 text-xs lg:gap-2 lg:px-3 lg:py-1 lg:text-sm",
		dotClass: "size-1.5 lg:size-2",
	},
} as const;

export type StatusPillTone = keyof typeof TONES;

interface StatusPillProps {
	tone: StatusPillTone;
	size?: keyof typeof SIZES;
	children: React.ReactNode;
	className?: string;
	"data-testid"?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
	tone,
	size = "md",
	children,
	className = "",
	"data-testid": testId,
}) => {
	const { pillClass, dotClass } = TONES[tone];
	const sizeClasses = SIZES[size];

	return (
		<span
			data-testid={testId}
			className={`inline-flex items-center self-start rounded-full border font-medium whitespace-nowrap ${sizeClasses.pillClass} ${pillClass} ${className}`}
		>
			<span
				className={`shrink-0 rounded-full ${sizeClasses.dotClass} ${dotClass}`}
				aria-hidden="true"
			/>
			{children}
		</span>
	);
};
