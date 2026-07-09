import { create } from "zustand";

interface ToastConfig {
	show: boolean;
	type: "success" | "error";
	title: string;
	message: string;
	docId?: string;
}

interface UIState {
	isChatOpen: boolean;
	toast: ToastConfig | null;
	toggleChat: () => void;
	openChat: () => void;
	closeChat: () => void;
	showToast: (toast: Omit<ToastConfig, "show">) => void;
	hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
	isChatOpen: false,
	toast: null,
	toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
	openChat: () => set({ isChatOpen: true }),
	closeChat: () => set({ isChatOpen: false }),
	showToast: (toast) => set({ toast: { ...toast, show: true } }),
	hideToast: () => set({ toast: null }),
}));
