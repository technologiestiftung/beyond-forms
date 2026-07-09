import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createZustandStorage } from "../utils/storage";
import type { TutorialResponse } from "../schemas/cms.schema";
import { cmsService } from "../services/cms";
import { ONBOARDING_TUTORIAL_SLUGS } from "../constants/onboardingTutorials";
import { STATIC_FALLBACK_TUTORIALS } from "../constants/fallbackTutorials";

interface TutorialState {
	tutorials: TutorialResponse[];
	isLoading: boolean;
	initialized: boolean;
	error: string | null;
	fetchTutorials: (force?: boolean) => Promise<void>;
	completeTutorial: (tutorialId: string) => Promise<void>;
	areAllTutorialsCompleted: () => boolean;
}

export const useTutorialStore = create<TutorialState>()(
	persist(
		(set, get) => ({
			tutorials: [],
			isLoading: false,
			initialized: false,
			error: null,

			fetchTutorials: async (force?: boolean) => {
				if (get().initialized && !force) {
					return;
				}
				set({ isLoading: true, error: null });
				try {
					const data = await cmsService.getMyTutorials();
					const finalData = data.length > 0 ? data : STATIC_FALLBACK_TUTORIALS;

					// Safely merge optimistic states to prevent UI glitches within the session's scope
					const existingCompletedIds = new Set(
						get()
							.tutorials.filter((t) => t.progress.status === "completed")
							.map((t) => t.id),
					);
					const mergedTutorials = finalData.map((item) =>
						existingCompletedIds.has(item.id)
							? {
									...item,
									progress: { ...item.progress, status: "completed" as const },
								}
							: item,
					);

					set({
						tutorials: mergedTutorials,
						isLoading: false,
						initialized: true,
					});
				} catch (err) {
					const message =
						err instanceof Error ? err.message : "Failed to fetch tutorials";
					const existingTutorials = get().tutorials;
					const finalFallback =
						existingTutorials.length > 0
							? existingTutorials
							: STATIC_FALLBACK_TUTORIALS;
					set({
						tutorials: finalFallback,
						error: message,
						isLoading: false,
						initialized: true,
					});
				}
			},

			completeTutorial: async (tutorialId: string) => {
				const currentTutorials = get().tutorials;
				const updatedTutorials = currentTutorials.map((t) =>
					t.id === tutorialId
						? {
								...t,
								progress: { ...t.progress, status: "completed" as const },
							}
						: t,
				);
				set({ tutorials: updatedTutorials });

				try {
					await cmsService.updateTutorialProgress({
						tutorial_id: tutorialId,
						status: "completed",
					});
				} catch (err) {
					console.warn(
						"Failed to sync tutorial completion to backend, continuing offline:",
						err,
					);
				}
			},

			areAllTutorialsCompleted: () => {
				const list = get().tutorials;
				const appGuide = list.find(
					(t) => t.slug === ONBOARDING_TUTORIAL_SLUGS.appGuide,
				);
				return appGuide?.progress.status === "completed";
			},
		}),
		{
			name: "beyond-forms-tutorial-session",
			// Keep using session storage to ensure multi-user public PC safety
			storage: createJSONStorage(() => createZustandStorage("session")),
			// Correctly track both variables inside sessionStorage to prevent the re-trigger loop
			partialize: (state) => ({
				tutorials: state.tutorials,
				initialized: state.initialized,
			}),
			version: 1,
		},
	),
);
