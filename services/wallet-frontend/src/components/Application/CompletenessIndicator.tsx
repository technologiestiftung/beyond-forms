import React from "react";
import { useTranslation } from "react-i18next";
import {
	MAX_MILESTONE_LEVEL,
	type MilestoneLevel,
} from "../../store/useProfileStore";

interface CompletenessIndicatorProps {
	level: MilestoneLevel;
}

const MILESTONE_PILLS = [
	{
		threshold: 1,
		barClass: "bg-status-incomplete",
		labelKey: "levels.pills.incomplete",
	},
	{
		threshold: 2,
		barClass: "bg-status-in-progress",
		labelKey: "levels.pills.advanced",
	},
	{
		threshold: MAX_MILESTONE_LEVEL,
		barClass: "bg-status-done",
		labelKey: "levels.pills.ready",
	},
] as const;

export const CompletenessIndicator: React.FC<CompletenessIndicatorProps> = ({
	level,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="w-full grid grid-cols-3 gap-1 xs:gap-2 text-center mt-1">
			{MILESTONE_PILLS.map(({ threshold, barClass, labelKey }) => {
				const isActive = level >= threshold;
				const isCurrentLevel = level === threshold;

				return (
					<div key={threshold} className="flex flex-col gap-1 min-w-0">
						<div
							className={`h-1.5 rounded-full transition-all ${isActive ? barClass : "bg-slate-200"}`}
						/>
						<span
							className={`text-[10px] xs:text-xs block wrap-break-word whitespace-normal transition-all ${
								isCurrentLevel
									? "text-brand-grey font-black scale-105"
									: "text-brand-grey font-medium"
							}`}
						>
							{t(labelKey)}
						</span>
					</div>
				);
			})}
		</div>
	);
};
