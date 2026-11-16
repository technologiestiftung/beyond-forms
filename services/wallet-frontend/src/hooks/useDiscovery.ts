import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { MatchResult } from "@beyond-forms/eligibility-engine";
import { selectProfile, useDiscoveryStore } from "../store/useDiscoveryStore";
import { localDateToday } from "../schemas/eligibility.schema";

export const useDiscoveryLanguage = () => {
	const { i18n } = useTranslation();
	return i18n.language?.startsWith("en") ? "en" : "de";
};

// Loaded on demand so pages that only might need the check don't pull in the RDF stack
const loadEngine = async () =>
	(
		await import("../services/eligibility/discoveryEngine")
	).getDiscoveryEngine();

/** Runs the knowledge-base check on the current answers */
export const useDiscoveryMatch = ({ enabled = true } = {}) => {
	const answers = useDiscoveryStore((s) => s.answers);
	const children = useDiscoveryStore((s) => s.children);
	const lang = useDiscoveryLanguage();

	return useQuery({
		queryKey: ["discovery", answers, children, lang],
		queryFn: async () =>
			(await loadEngine()).match(
				{ answers, children },
				{ today: localDateToday(), lang },
			),
		enabled,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});
};

/** Evaluates the latest answers right away, e.g. to decide where "next" leads */
export const useMatchNow = () => {
	const lang = useDiscoveryLanguage();
	return useCallback(
		async (): Promise<MatchResult> =>
			(await loadEngine()).match(selectProfile(useDiscoveryStore.getState()), {
				today: localDateToday(),
				lang,
			}),
		[lang],
	);
};
