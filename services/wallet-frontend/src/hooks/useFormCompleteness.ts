import { useQuery } from "@tanstack/react-query";
import { env } from "../config/env.config";
import { authenticatedFetch } from "../utils/apiClient";
import { MAX_MILESTONE_LEVEL, type MilestoneLevel } from "../store/useProfileStore";

interface FormCompletenessResponse {
	filled_fields: number;
	total_fields: number;
}

/**
 * Mirrors the 3-tier thresholds of calculateCompletenessIndicatorLevel (utils/profile.ts)
 * so per-form and profile-wide progress bars read consistently.
 */
function levelFromRatio(filled: number, total: number): MilestoneLevel {
	if (total === 0 || filled === 0) {
		return 0;
	}
	const percentage = (filled / total) * 100;
	if (percentage <= 29) {
		return 1;
	}
	if (percentage === 100) {
		return MAX_MILESTONE_LEVEL;
	}
	return 2;
}

/**
 * Reports how ready a specific form (e.g. "antrag_wohngeld") is to generate, based
 * on how many of the profile fields its mapping reads from are actually filled in —
 * unlike the Grundsicherung milestone, this doesn't require document verification.
 */
export function useFormCompleteness(formType: string) {
	const { data, isLoading } = useQuery<MilestoneLevel>({
		queryKey: ["form-completeness", formType],
		queryFn: async () => {
			if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
				// Mock/dev profiles are seeded fully filled in; skip the network call.
				return MAX_MILESTONE_LEVEL;
			}
			const response = await authenticatedFetch(
				`${env.VITE_API_URL}/export/${formType}/completeness`,
			);
			if (!response.ok) {
				throw new Error(`Failed to load completeness: ${response.statusText}`);
			}
			const data = (await response.json()) as FormCompletenessResponse;
			return levelFromRatio(data.filled_fields, data.total_fields);
		},
	});

	return { level: data ?? 0, isLoading };
}
