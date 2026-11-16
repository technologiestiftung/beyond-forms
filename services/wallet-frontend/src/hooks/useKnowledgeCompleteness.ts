import { useQuery } from "@tanstack/react-query";
import { profileFromBackend } from "@beyond-forms/eligibility-engine";
import { env } from "../config/env.config";
import { localDateToday } from "../schemas/eligibility.schema";
import {
	STORED_PROFILE_KEY,
	fetchStoredProfile,
} from "../services/eligibility/storedProfile";
import {
	MAX_MILESTONE_LEVEL,
	type MilestoneLevel,
} from "../store/useProfileStore";
import { levelFromRatio } from "./useFormCompleteness";

/**
 * Like useFormCompleteness, but counts the fields the knowledge base's application profile
 * requires, so the card agrees with what the guided questions still ask for.
 */
export function useKnowledgeCompleteness(applicationId?: string) {
	const enabled = applicationId !== undefined;
	const { data: stored } = useQuery({
		queryKey: STORED_PROFILE_KEY,
		queryFn: fetchStoredProfile,
		enabled: enabled && !env.VITE_USE_MOCKS && !env.VITE_USE_MOCK_AUTH,
	});
	const { data, isLoading } = useQuery<MilestoneLevel>({
		queryKey: ["knowledgeCompleteness", applicationId, stored],
		queryFn: async () => {
			if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
				// Same as useFormCompleteness: mock profiles count as filled in
				return MAX_MILESTONE_LEVEL;
			}
			const { getDiscoveryEngine } = await import(
				"../services/eligibility/discoveryEngine"
			);
			const engine = getDiscoveryEngine();
			const progress = await engine.progress(
				profileFromBackend(engine, stored ?? {}),
				applicationId ?? "",
				{ today: localDateToday() },
			);
			return progress.complete
				? MAX_MILESTONE_LEVEL
				: levelFromRatio(progress.answeredCount, progress.steps.length);
		},
		enabled:
			enabled &&
			(stored !== undefined || env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH),
	});

	return { level: data ?? 0, isLoading };
}
