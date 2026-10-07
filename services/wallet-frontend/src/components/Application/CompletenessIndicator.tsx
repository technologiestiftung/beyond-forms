import React from "react";
import { useTranslation } from "react-i18next";
import {
	MAX_MILESTONE_LEVEL,
	type MilestoneLevel,
} from "../../store/useProfileStore";

interface CompletenessIndicatorProps {
	level: MilestoneLevel;
}

const STATUS_BADGE = {
	started: {
		pillClass: "border-slate-300 bg-slate-50 text-slate-600",
		dotClass: "bg-slate-300",
		label: ["levels.status.started", "Gestartet"],
	},
	missing: {
		pillClass:
			"border-secondary-orange-500 bg-secondary-orange-20 text-secondary-orange-800",
		dotClass: "bg-secondary-orange-500",
		label: ["levels.status.missing", "Fehlt noch etwas"],
	},
	complete: {
		pillClass: "border-green-600 bg-green-50 text-green-700",
		dotClass: "bg-green-600",
		label: ["levels.status.complete", "Komplett"],
	},
} as const;

const getStatus = (level: MilestoneLevel): keyof typeof STATUS_BADGE => {
	if (level >= MAX_MILESTONE_LEVEL) {
		return "complete";
	}
	if (level >= 2) {
		return "missing";
	}
	return "started";
};

export const CompletenessIndicator: React.FC<CompletenessIndicatorProps> = ({
	level,
}) => {
	const { t } = useTranslation("application");
	const { pillClass, dotClass, label } = STATUS_BADGE[getStatus(level)];

	return (
		<span
			data-testid="completeness-indicator"
			className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap ${pillClass}`}
		>
			<span
				className={`size-2 shrink-0 rounded-full ${dotClass}`}
				aria-hidden="true"
			/>
			{t(...label)}
		</span>
	);
};
