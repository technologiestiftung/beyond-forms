import { useMemo } from "react";
import { useEligibilityStore } from "../store/useEligibilityStore";
import { EligibilityEngine } from "../store/EligibilityEngine";
import { ResultProfile } from "../schemas/eligibility.schema";

const PROFILE_TRANSLATION_KEYS: Record<ResultProfile, string> = {
	[ResultProfile.ELIGIBLE]: "eligible",
	[ResultProfile.NOT_ELIGIBLE]: "not_eligible",
	[ResultProfile.SOZIALAMT]: "sozialamt",
};

export function useEligibilityOutcome() {
	const answers = useEligibilityStore((s) => s.answers);

	const path = useMemo(
		() => EligibilityEngine.getValidPath(answers),
		[answers],
	);
	const profile = useMemo(
		() => EligibilityEngine.getOutcomeProfile(path),
		[path],
	);

	const hasError = useMemo(() => !profile, [profile]);
	const translationKey = useMemo(
		() => (profile ? PROFILE_TRANSLATION_KEYS[profile] : ""),
		[profile],
	);

	return {
		profile,
		hasError,
		translationKey,
		path,
	};
}
