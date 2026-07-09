import React from "react";

export type SectionStatus = "MISSING" | "PARTIAL" | "COMPLETE" | "PROCESSING";

interface ProfileSectionCardProps {
	title: string;
	description: string;
	status?: SectionStatus;
	icon?: React.ReactNode;
	onClick: () => void;
	"data-testid"?: string;
}

export const ProfileSectionCard: React.FC<ProfileSectionCardProps> = ({
	title,
	description,
	status,
	icon,
	onClick,
	"data-testid": testId,
}) => {
	let statusColor = "bg-slate-300";
	if (status === "COMPLETE") {
		statusColor = "bg-green-500";
	} else if (status === "PARTIAL") {
		statusColor = "bg-amber-500";
	} else if (status === "PROCESSING") {
		statusColor = "bg-brand-navy animate-pulse";
	}

	return (
		<button
			type="button"
			onClick={onClick}
			data-testid={testId}
			className="w-full flex items-start gap-4 p-5 bg-white rounded-2xl border border-brand-border-subtle shadow-sm hover:border-brand-border transition-all text-left active:scale-[0.99]"
		>
			{icon && (
				<div className="size-12 bg-primary-green-500 rounded-xl flex items-center justify-center shrink-0 text-primary-blue-500">
					{icon}
				</div>
			)}
			<div className="flex flex-col gap-0.5 flex-1 min-w-0 mt-0.5">
				<div className="flex items-center gap-2">
					<h2 className="text-lg font-bold text-brand-carbon">{title}</h2>
					{status && (
						<span
							data-testid="status-indicator"
							className={`size-2 rounded-full ${statusColor} shrink-0`}
						/>
					)}
				</div>
				<p className="text-xs text-brand-black/80 leading-relaxed">
					{description}
				</p>
			</div>
		</button>
	);
};
