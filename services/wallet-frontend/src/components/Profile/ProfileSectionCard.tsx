import React from "react";
import { ChevronRight } from "lucide-react";

export type SectionStatus = "MISSING" | "PARTIAL" | "COMPLETE" | "PROCESSING";

interface ProfileSectionCardProps {
	title: string;
	description: string;
	status?: SectionStatus;
	statusLabel?: string;
	actionLabel?: string;
	icon?: React.ReactNode;
	onClick: () => void;
	"data-testid"?: string;
}

const STATUS_DOT: Record<SectionStatus, string> = {
	COMPLETE: "bg-green-500 lg:bg-green-600",
	PARTIAL: "bg-amber-500 lg:bg-secondary-orange-500",
	PROCESSING: "bg-primary-blue-500 animate-pulse",
	MISSING: "bg-slate-300",
};

const STATUS_PILL: Record<SectionStatus, string> = {
	COMPLETE: "lg:border-green-600 lg:bg-green-50 lg:text-green-700",
	PARTIAL:
		"lg:border-secondary-orange-500 lg:bg-secondary-orange-20 lg:text-secondary-orange-800",
	PROCESSING: "lg:border-brand-border lg:bg-brand-bg lg:text-primary-blue-500",
	MISSING: "lg:border-slate-300 lg:bg-slate-50 lg:text-slate-600",
};

export const ProfileSectionCard: React.FC<ProfileSectionCardProps> = ({
	title,
	description,
	status,
	statusLabel,
	actionLabel,
	icon,
	onClick,
	"data-testid": testId,
}) => {
	return (
		<button
			type="button"
			onClick={onClick}
			data-testid={testId}
			className="w-full flex items-start gap-4 p-5 bg-white rounded-2xl border border-brand-border-subtle shadow-sm hover:border-brand-border transition-all text-left active:scale-[0.99] lg:flex-col lg:gap-5 lg:p-6 lg:h-full"
		>
			{icon && (
				<div className="size-12 bg-primary-green-500 rounded-xl flex items-center justify-center shrink-0 text-primary-blue-500 lg:size-14">
					{icon}
				</div>
			)}
			<div className="flex flex-col gap-0.5 flex-1 min-w-0 mt-0.5 lg:mt-0 lg:w-full lg:gap-3">
				<div className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-3">
					<h2 className="text-lg font-bold text-brand-black lg:text-xl">
						{title}
					</h2>
					{status && (
						<span
							data-testid="status-indicator"
							className={`inline-flex items-center gap-2 shrink-0 rounded-full lg:border lg:px-3 lg:py-1 ${STATUS_PILL[status]}`}
						>
							<span
								className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`}
								aria-hidden="true"
							/>
							{statusLabel && (
								<span className="max-lg:sr-only text-sm font-medium whitespace-nowrap">
									{statusLabel}
								</span>
							)}
						</span>
					)}
				</div>
				<p className="text-xs text-brand-black/80 leading-relaxed lg:text-sm">
					{description}
				</p>
				{actionLabel && (
					<span className="hidden lg:mt-auto lg:inline-flex lg:items-center lg:gap-1 lg:self-end text-sm font-bold text-primary-blue-500">
						{actionLabel}
						<ChevronRight className="size-4" aria-hidden="true" />
					</span>
				)}
			</div>
		</button>
	);
};
