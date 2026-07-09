import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_LOCALE } from "../constants/locale";
import { createZustandStorage } from "../utils/storage";

interface PreferencesState {
	language: string;
	lastSelectedNav: string | null;
	setLanguage: (lang: string) => void;
	setLastSelectedNav: (path: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
	persist(
		(set) => ({
			language: DEFAULT_LOCALE,
			lastSelectedNav: null,
			setLanguage: (language) => set({ language }),
			setLastSelectedNav: (lastSelectedNav) => set({ lastSelectedNav }),
		}),
		{
			name: "beyond-forms-preferences",
			storage: createJSONStorage(() => createZustandStorage("local")),
			version: 1,
		},
	),
);
