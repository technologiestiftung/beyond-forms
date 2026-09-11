import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BenefitCheckAnswersSchema } from "../schemas/benefitCheck.schema";
import type {
	BenefitCheckAnswers,
	PartialBenefitCheckAnswers,
} from "../schemas/benefitCheck.schema";
import { getValidPath } from "./benefits/questionPath";
import { createZustandStorage } from "../utils/storage";
import { todayIsoDate } from "../utils/date";

interface BenefitCheckState {
	answers: PartialBenefitCheckAnswers;
	maxDepthReached: number;
	validationError: string | null;
	setAnswer: <K extends keyof BenefitCheckAnswers>(
		field: K,
		value: BenefitCheckAnswers[K],
	) => void;
	clearAnswer: (field: keyof BenefitCheckAnswers) => void;
	recordStepReached: (step: number) => void;
	resetForm: () => void;
	clearError: () => void;
}

export const useBenefitCheckStore = create<BenefitCheckState>()(
	persist(
		(set, get) => {
			const pathLength = (answers: PartialBenefitCheckAnswers): number =>
				getValidPath(answers, todayIsoDate()).length;

			return {
				answers: {},
				maxDepthReached: 0,
				validationError: null,

				setAnswer: (field, value) => {
					const fieldSchema = BenefitCheckAnswersSchema.shape[field];
					const result = fieldSchema.safeParse(value);
					if (!result.success) {
						set({ validationError: result.error.issues[0].message });
						return;
					}
					const answers = { ...get().answers, [field]: result.data };
					set({
						answers,
						validationError: null,
						maxDepthReached: Math.min(
							get().maxDepthReached,
							pathLength(answers),
						),
					});
				},

				clearAnswer: (field) => {
					const { [field]: _removed, ...answers } = get().answers;
					set({
						answers,
						validationError: null,
						maxDepthReached: Math.min(
							get().maxDepthReached,
							pathLength(answers),
						),
					});
				},

				recordStepReached: (step) => {
					set({
						maxDepthReached: Math.min(
							Math.max(get().maxDepthReached, step),
							pathLength(get().answers),
						),
					});
				},

				resetForm: () =>
					set({ answers: {}, maxDepthReached: 0, validationError: null }),

				clearError: () => set({ validationError: null }),
			};
		},
		{
			name: "beyond-forms-wallet-session",
			storage: createJSONStorage(() => createZustandStorage("session")),
			// 8 was the last version of useEligibilityStore, whose answer shape is
			// incompatible. Without the bump an open tab would carry old answers into
			// per-field validation and fail on every one.
			version: 9,
		},
	),
);
