import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
	AnswerValue,
	PersonAnswers,
	Profile,
} from "@beyond-forms/eligibility-engine";
import { createZustandStorage } from "../utils/storage";

interface DiscoveryState {
	answers: PersonAnswers;
	children: PersonAnswers[];
	/** Questions in the order they were answered, for back navigation */
	history: string[];
	setAnswer: (field: string, value: AnswerValue) => void;
	setChildren: (children: PersonAnswers[]) => void;
	clearAnswer: (field: string) => void;
	reset: () => void;
}

const remember = (history: string[], field: string) =>
	history.includes(field) ? history : [...history, field];

export const useDiscoveryStore = create<DiscoveryState>()(
	persist(
		(set) => ({
			answers: {},
			children: [],
			history: [],
			setAnswer: (field, value) =>
				set((state) => ({
					answers: { ...state.answers, [field]: value },
					history: remember(state.history, field),
				})),
			setChildren: (children) =>
				set((state) => ({
					children,
					history: remember(state.history, "hasChild"),
				})),
			clearAnswer: (field) =>
				set((state) => {
					if (field === "hasChild") {
						return { children: [] };
					}
					const { [field]: _removed, ...answers } = state.answers;
					return { answers };
				}),
			reset: () => set({ answers: {}, children: [], history: [] }),
		}),
		{
			name: "beyond-forms-discovery-session",
			storage: createJSONStorage(() => createZustandStorage("session")),
			version: 1,
		},
	),
);

export const selectProfile = (state: DiscoveryState): Profile => ({
	answers: state.answers,
	children: state.children,
});
