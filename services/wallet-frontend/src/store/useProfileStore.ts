import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletDocument } from "../schemas/profile.schema";

export const MAX_MILESTONE_LEVEL = 3 as const;
export type MilestoneLevel = 0 | 1 | 2 | typeof MAX_MILESTONE_LEVEL;

export type ProfileTab = "persona" | "financial" | "documents" | "settings";
export type ApplicationStatus =
	"idle" | "draft" | "in_progress" | "submitted" | "success";

interface ProfileUIState {
	isEditMode: boolean;
	activeTab: ProfileTab;
	documents: WalletDocument[];
	applicationStatus: ApplicationStatus;
	milestoneLevel: MilestoneLevel;
	setEditMode: (isEdit: boolean) => void;
	setActiveTab: (tab: ProfileTab) => void;
	setDocuments: (documents: WalletDocument[]) => void;
	setApplicationStatus: (status: ApplicationStatus) => void;
	setMilestoneLevel: (level: MilestoneLevel) => void;
	reset: () => void;
}

/**
 * useProfileStore manages local UI state for the profile view.
 * Persists navigation state to localStorage.
 */
export const useProfileStore = create<ProfileUIState>()(
	persist(
		(set) => ({
			isEditMode: false,
			activeTab: "persona",
			documents: [],
			applicationStatus: "idle",
			milestoneLevel: 0,
			setEditMode: (isEdit) => set({ isEditMode: isEdit }),
			setActiveTab: (tab) => set({ activeTab: tab }),
			setDocuments: (documents) => set({ documents }),
			setApplicationStatus: (status) => set({ applicationStatus: status }),
			setMilestoneLevel: (level) => set({ milestoneLevel: level }),
			reset: () =>
				set({
					isEditMode: false,
					activeTab: "persona",
					documents: [],
					applicationStatus: "idle",
					milestoneLevel: 0,
				}),
		}),
		{
			name: "beyond-forms-profile-ui",
			partialize: (state) => ({
				activeTab: state.activeTab,
				documents: state.documents,
				applicationStatus: state.applicationStatus,
				milestoneLevel: state.milestoneLevel,
			}),
		},
	),
);
