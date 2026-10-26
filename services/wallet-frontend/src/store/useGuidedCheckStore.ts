import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createZustandStorage } from "../utils/storage";
import type { EligibilityCheck } from "../schemas/eligibility.schema";

type Field = keyof EligibilityCheck;

interface GuidedCheckState {
	isActive: boolean;
	/** Answers taken from free text, confirmed together before the result. */
	provisionalFields: Field[];
	/** The card currently waiting for an answer. */
	openSurfaceId: string | null;
	setOpenSurface: (surfaceId: string | null) => void;
	start: () => void;
	finish: () => void;
	markProvisional: (field: Field) => void;
	markFixed: (field: Field) => void;
	clearProvisional: () => void;
	reset: () => void;
}

export const useGuidedCheckStore = create<GuidedCheckState>()(
	persist(
		(set) => ({
			isActive: false,
			provisionalFields: [],
			openSurfaceId: null,
			setOpenSurface: (surfaceId) => set({ openSurfaceId: surfaceId }),
			start: () => set({ isActive: true }),
			finish: () => set({ isActive: false }),
			markProvisional: (field) =>
				set((s) => ({
					provisionalFields: s.provisionalFields.includes(field)
						? s.provisionalFields
						: [...s.provisionalFields, field],
				})),
			markFixed: (field) =>
				set((s) => ({
					provisionalFields: s.provisionalFields.filter((f) => f !== field),
				})),
			clearProvisional: () => set({ provisionalFields: [] }),
			reset: () =>
				set({ isActive: false, provisionalFields: [], openSurfaceId: null }),
		}),
		{
			name: "beyond-forms-guided-check",
			storage: createJSONStorage(() => createZustandStorage("session")),
			version: 1,
		},
	),
);
