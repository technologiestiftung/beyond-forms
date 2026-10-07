import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
	EligibilityCheckSchema,
	ResultProfile,
} from "../schemas/eligibility.schema";
import type { EligibilityCheck } from "../schemas/eligibility.schema";
import { EligibilityEngine } from "./EligibilityEngine";
import { createZustandStorage } from "../utils/storage";

interface EligibilityState {
	answers: Partial<EligibilityCheck>;
	validationError: string | null;
	setAnswer: <K extends keyof EligibilityCheck>(
		key: K,
		value: EligibilityCheck[K],
	) => void;
	clearAnswer: <K extends keyof EligibilityCheck>(key: K) => void;
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

				set({
					answers: nextAnswers,
					validationError: null,
					isEligible: profile === ResultProfile.ELIGIBLE,
				});
			};

			return {
				answers: {},
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

				resetForm: () => {
					set({
						answers: {},
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
			version: 9,
		},
	),
);
