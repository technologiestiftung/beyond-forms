import { create } from "zustand";

interface PendingUploadState {
	pendingFile: File | null;
	setPendingFile: (file: File | null) => void;
	takePendingFile: () => File | null;
}

/** Hands a file dropped outside the upload flow over to its first step. */
export const usePendingUploadStore = create<PendingUploadState>((set, get) => ({
	pendingFile: null,
	setPendingFile: (file) => set({ pendingFile: file }),
	takePendingFile: () => {
		const { pendingFile } = get();
		if (pendingFile) {
			set({ pendingFile: null });
		}
		return pendingFile;
	},
}));
