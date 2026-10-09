import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createZustandStorage } from "../utils/storage";
import { chatService } from "../services/chat";
import { useAuthStore } from "./useAuthStore";
import { queryClient } from "../config/queryClient";
import i18n from "../i18n";
import { processA2uiMessages } from "../a2ui/processor";
import { surfaceIdOf, type A2uiMessage } from "../a2ui/messages";
import {
	handleEligibilityAnswer,
	showNextGuidedStep,
} from "../a2ui/guidedCheckAgent";
import { useGuidedCheckStore } from "./useGuidedCheckStore";
import { currentGuidedField } from "./guidedCheck";

export type ChatMessage =
	| {
			id: string;
			role: "user" | "assistant";
			content: string;
	  }
	| {
			id: string;
			role: "a2ui";
			surfaceId: string;
			/** Everything sent to the surface so far, replayed after a reload. */
			messages: A2uiMessage[];
	  };

const recordA2ui = (
	messages: ChatMessage[],
	message: A2uiMessage,
): ChatMessage[] => {
	const surfaceId = surfaceIdOf(message);
	if ("createSurface" in message) {
		return [
			...messages,
			{ id: crypto.randomUUID(), role: "a2ui", surfaceId, messages: [message] },
		];
	}
	if ("deleteSurface" in message) {
		return messages.filter(
			(m) => m.role !== "a2ui" || m.surfaceId !== surfaceId,
		);
	}
	return messages.map((m) =>
		m.role === "a2ui" && m.surfaceId === surfaceId
			? { ...m, messages: [...m.messages, message] }
			: m,
	);
};

interface ChatState {
	messages: ChatMessage[];
	isLoading: boolean;
	error: string | null;
	sendMessage: (text: string) => Promise<void>;
	applyA2ui: (messages: A2uiMessage[]) => void;
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
						locale: i18n.language,
						guidedCheck: useGuidedCheckStore.getState().isActive
							? { currentField: currentGuidedField() }
							: undefined,
						onA2ui: (message) => get().applyA2ui([message]),
						onEligibilityAnswer: handleEligibilityAnswer,
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
								showNextGuidedStep();
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

			applyA2ui: (messages) => {
				try {
					processA2uiMessages(messages);
				} catch (e) {
					console.warn("Ignored invalid A2UI messages", e);
					return;
				}
				set((s) => ({ messages: messages.reduce(recordA2ui, s.messages) }));
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
