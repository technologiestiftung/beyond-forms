import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createZustandStorage } from "../utils/storage";
import { chatService } from "../services/chat";
import { useAuthStore } from "./useAuthStore";
import { queryClient } from "../config/queryClient";
import {
	ChatCardViewSchema,
	type ChatCardValue,
	type ChatCardView,
} from "../schemas/chatCard.schema";
import type { ChatStreamCallbacks } from "../services/chat/IChatService";

export type ChatTextMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

/** A card the assistant showed inline; `answer` holds the values once the user submitted it. */
export type ChatCardMessage = {
	id: string;
	role: "card";
	toolCallId: string;
	card: ChatCardView;
	answer?: Record<string, ChatCardValue>;
};

export type ChatMessage = ChatTextMessage | ChatCardMessage;

const SHOW_CARD_TOOL = "show_card";

interface ChatState {
	messages: ChatMessage[];
	isLoading: boolean;
	error: string | null;
	sendMessage: (text: string) => Promise<void>;
	answerCard: (
		toolCallId: string,
		values: Record<string, ChatCardValue>,
	) => Promise<void>;
	newChat: () => Promise<void>;
	clearError: () => void;
	reset: () => void;
}

export const useChatStore = create<ChatState>()(
	persist(
		(set, get) => {
			/**
			 * Streams one assistant reply into a new message. Cards the assistant shows
			 * are appended after its text. Resolves to whether the reply arrived.
			 */
			const streamReply = async (
				request: (callbacks: ChatStreamCallbacks) => Promise<void>,
			): Promise<boolean> => {
				const assistantId = crypto.randomUUID();
				set((s) => ({
					messages: [
						...s.messages,
						{ id: assistantId, role: "assistant" as const, content: "" },
					],
					isLoading: true,
					error: null,
				}));

				let succeeded = false;
				const fail = (message: string) => {
					set((s) => ({
						messages: s.messages.filter((m) => m.id !== assistantId),
						isLoading: false,
						error: message,
					}));
				};

				try {
					await request({
						onResponse: (response) => {
							set((s) => ({
								messages: s.messages.map((m) =>
									m.id === assistantId ? { ...m, content: response } : m,
								),
							}));
						},
						onToolCall: ({ toolCallId, name, args }) => {
							const card = ChatCardViewSchema.safeParse(args);
							if (name !== SHOW_CARD_TOOL || !card.success) {
								return;
							}
							set((s) => ({
								messages: [
									...s.messages,
									{
										id: crypto.randomUUID(),
										role: "card" as const,
										toolCallId,
										card: card.data,
									},
								],
							}));
						},
						onDone: () => {
							succeeded = true;
							set((s) => ({
								isLoading: false,
								messages: s.messages.filter(
									(m) =>
										m.id !== assistantId ||
										m.role !== "assistant" ||
										m.content.length > 0,
								),
							}));
							void queryClient.invalidateQueries({ queryKey: ["profile"] });
						},
						onError: fail,
					});
				} catch (e) {
					fail(e instanceof Error ? e.message : "Unknown error");
				}
				return succeeded;
			};

			return {
				messages: [],
				isLoading: false,
				error: null,

				sendMessage: async (text: string) => {
					const trimmed = text.trim();
					if (!trimmed || get().isLoading) {
						return;
					}

					// TODO: When chat history is stored in the database, sync outgoing messages here

					set((s) => ({
						messages: [
							...s.messages,
							{
								id: crypto.randomUUID(),
								role: "user" as const,
								content: trimmed,
							},
						],
					}));
					await streamReply((callbacks) =>
						chatService.sendMessage({ content: trimmed, ...callbacks }),
					);
				},

				answerCard: async (
					toolCallId: string,
					values: Record<string, ChatCardValue>,
				) => {
					const card = get().messages.find(
						(m): m is ChatCardMessage =>
							m.role === "card" && m.toolCallId === toolCallId,
					);
					if (!card || card.answer !== undefined || get().isLoading) {
						return;
					}

					const setAnswer = (
						value: Record<string, ChatCardValue> | undefined,
					) =>
						set((s) => ({
							messages: s.messages.map((m) =>
								m.id === card.id ? { ...m, answer: value } : m,
							),
						}));

					setAnswer(values);
					const succeeded = await streamReply((callbacks) =>
						chatService.sendToolResult({
							toolCallId,
							content: JSON.stringify({ values }),
							...callbacks,
						}),
					);
					if (!succeeded) {
						// lets the user submit the card again
						setAnswer(undefined);
					}
				},

				clearError: () => set({ error: null }),

				newChat: async () => {
					set({ messages: [], isLoading: true, error: null });
					try {
						await chatService.newChat();
						set({ isLoading: false, error: null });
					} catch (e) {
						set({
							isLoading: false,
							error:
								e instanceof Error ? e.message : "Failed to start new chat",
						});
					}
				},

				reset: () => set({ messages: [], isLoading: false, error: null }),
			};
		},
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
