import React from "react";
import { useTranslation } from "react-i18next";
import {
	MAX_MILESTONE_LEVEL,
	type MilestoneLevel,
} from "../../store/useProfileStore";
import { StatusPill } from "../ui/StatusPill";

interface CompletenessIndicatorProps {
	level: MilestoneLevel;
}

const STATUS_BADGE = {
	started: {
		tone: "neutral",
		label: ["levels.status.started", "Gestartet"],
	},
	missing: {
		tone: "warning",
		label: ["levels.status.missing", "Fehlt noch etwas"],
	},
	complete: {
		tone: "success",
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
	const { tone, label } = STATUS_BADGE[getStatus(level)];

	return (
		<StatusPill tone={tone} data-testid="completeness-indicator">
			{t(...label)}
		</StatusPill>
	);
};
