import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
	EligibilityCheckSchema,
	ResultProfile,
} from "../schemas/eligibility.schema";
import type { EligibilityCheck } from "../schemas/eligibility.schema";
import { EligibilityEngine } from "./EligibilityEngine";
import { createZustandStorage } from "../utils/storage";

export const ELIGIBILITY_TOTAL_STEPS = 6;

interface EligibilityState {
	answers: Partial<EligibilityCheck>;
	maxDepthReached: number;
	validationError: string | null;
	setAnswer: <K extends keyof EligibilityCheck>(
		key: K,
		value: EligibilityCheck[K],
	) => void;
	clearAnswer: <K extends keyof EligibilityCheck>(key: K) => void;
	recordStepReached: (step: number) => void;
	resetForm: () => void;
	clearError: () => void;
	isEligible: boolean;
}

export const useEligibilityStore = create<EligibilityState>()(
	persist(
		(set, get) => {
			const applyAnswers = (nextAnswers: Partial<EligibilityCheck>) => {
				const currentPath = EligibilityEngine.getValidPath(nextAnswers);
				const profile = EligibilityEngine.getOutcomeProfile(currentPath);
				const pathLength = currentPath.filter((id) => {
					const node = EligibilityEngine.getNode(id);
					return node && node.type !== "result";
				}).length;

				set({
					answers: nextAnswers,
					validationError: null,
					isEligible: profile === ResultProfile.ELIGIBLE,
					maxDepthReached: Math.min(get().maxDepthReached, pathLength),
				});
			};

			return {
				answers: {},
				maxDepthReached: 0,
				validationError: null,
				isEligible: false,

				setAnswer: (key, value) => {
					const fieldSchema = EligibilityCheckSchema.shape[key];
					const result = fieldSchema.safeParse(value);

					if (!result.success) {
						set({
							validationError: result.error.issues[0].message,
						});
						return;
					}

					const nextAnswers = { ...get().answers, [key]: value };
					applyAnswers(nextAnswers);
				},

				clearAnswer: (key) => {
					const { [key]: _removed, ...rest } = get().answers;
					applyAnswers(rest);
				},

				recordStepReached: (step) => {
					const currentPath = EligibilityEngine.getValidPath(get().answers);
					const pathLength = currentPath.filter((id) => {
						const node = EligibilityEngine.getNode(id);
						return node && node.type !== "result";
					}).length;
					set({
						maxDepthReached: Math.min(
							Math.max(get().maxDepthReached, step),
							pathLength,
						),
					});
				},

				resetForm: () => {
					set({
						answers: {},
						maxDepthReached: 0,
						validationError: null,
						isEligible: false,
					});
				},

				clearError: () => set({ validationError: null }),
			};
		},
		{
			name: "beyond-forms-wallet-session",
			storage: createJSONStorage(() => createZustandStorage("session")),
			version: 8,
		},
	),
);
