import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createZustandStorage } from "../utils/storage";
import { chatService } from "../services/chat";
import { useAuthStore } from "./useAuthStore";
import { queryClient } from "../config/queryClient";
import { ChatUiComponent, type ChatUi } from "../schemas/chat.schema";
import { useGuidedCheckStore } from "./useGuidedCheckStore";
import {
	chatUiFromServer,
	currentGuidedField,
	nextGuidedStep,
} from "./guidedCheck";

export type ChatMessage =
	| {
			id: string;
			role: "user" | "assistant";
			content: string;
	  }
	| ({ id: string; role: "ui" } & ChatUi);

interface ChatState {
	messages: ChatMessage[];
	isLoading: boolean;
	error: string | null;
	sendMessage: (text: string) => Promise<void>;
	appendUi: (ui: ChatUi) => void;
	markUiAnswered: (id: string) => void;
	showNextGuidedStep: () => void;
	newChat: () => Promise<void>;
	clearError: () => void;
	reset: () => void;
}

export const useChatStore = create<ChatState>()(
	persist(
		(set, get) => ({
			messages: [],
			isLoading: false,
			error: null,

			sendMessage: async (text: string) => {
				const trimmed = text.trim();
				if (!trimmed || get().isLoading) {
					return;
				}

				// TODO: When chat history is stored in the database, sync outgoing messages here

				const userId = crypto.randomUUID();
				const assistantId = crypto.randomUUID();

				set((s) => ({
					messages: [
						...s.messages,
						{ id: userId, role: "user" as const, content: trimmed },
						{ id: assistantId, role: "assistant" as const, content: "" },
					],
					isLoading: true,
					error: null,
				}));

				try {
					await chatService.sendMessage({
						content: trimmed,
						guidedCheck: useGuidedCheckStore.getState().isActive
							? { currentField: currentGuidedField() }
							: undefined,
						onUi: (event) => {
							const ui = chatUiFromServer(event);
							if (ui) {
								get().appendUi(ui);
							}
						},
						onResponse: (response) => {
							set((s) => ({
								messages: s.messages.map((m) =>
									m.id === assistantId ? { ...m, content: response } : m,
								),
							}));
						},
						onDone: () => {
							set((s) => ({
								isLoading: false,
								messages: s.messages.filter(
									(m) =>
										m.id !== assistantId ||
										m.role !== "assistant" ||
										m.content.length > 0,
								),
							}));
							if (useGuidedCheckStore.getState().isActive) {
								get().showNextGuidedStep();
							}
							void queryClient.invalidateQueries({ queryKey: ["profile"] });
						},
						onError: (message) => {
							set((s) => ({
								messages: s.messages.filter((m) => m.id !== assistantId),
								isLoading: false,
								error: message,
							}));
						},
					});
				} catch (e) {
					set((s) => ({
						messages: s.messages.filter((m) => m.id !== assistantId),
						isLoading: false,
						error: e instanceof Error ? e.message : "Unknown error",
					}));
				}
			},

			appendUi: (ui) =>
				set((s) => ({
					messages: [
						...s.messages,
						{ id: crypto.randomUUID(), role: "ui" as const, ...ui },
					],
				})),

			markUiAnswered: (id) =>
				set((s) => ({
					messages: s.messages.map((m) =>
						m.id === id && m.role === "ui"
							? { ...m, props: { ...m.props, answered: true } }
							: m,
					),
				})),

			showNextGuidedStep: () => {
				const step = nextGuidedStep();
				if (step.component === ChatUiComponent.ELIGIBILITY_RESULT) {
					useGuidedCheckStore.getState().finish();
				}
				get().appendUi(step);
			},

			clearError: () => set({ error: null }),

			newChat: async () => {
				set({ messages: [], isLoading: true, error: null });
				useGuidedCheckStore.getState().reset();
				try {
					await chatService.newChat();
					set({ isLoading: false, error: null });
				} catch (e) {
					set({
						isLoading: false,
						error: e instanceof Error ? e.message : "Failed to start new chat",
					});
				}
			},

			reset: () => set({ messages: [], isLoading: false, error: null }),
		}),
		{
			name: "beyond-forms-chat",
			storage: createJSONStorage(() => createZustandStorage("session")),
			partialize: (state) => ({ messages: state.messages }),
			version: 1,
		},
	),
);

useAuthStore.subscribe((state, prevState) => {
	if (prevState.token !== null && state.token === null) {
		useChatStore.getState().reset();
	}
});
