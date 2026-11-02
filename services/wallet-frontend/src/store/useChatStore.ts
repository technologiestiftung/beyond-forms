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

/**
 * A card the assistant showed inline; `answer` holds the values once the user submitted it.
 * `closed` marks a card the server no longer takes an answer for, e.g. after the user typed instead.
 */
export type ChatCardMessage = {
	id: string;
	role: "card";
	toolCallId: string;
	card: ChatCardView;
	answer?: Record<string, ChatCardValue>;
	closed?: boolean;
};

export type ChatMessage = ChatTextMessage | ChatCardMessage;

const SHOW_CARD_TOOL = "show_card";

type ReplyOutcome = { succeeded: boolean; started: boolean; status?: number };

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
			 * are appended after its text. Resolves to whether the reply arrived, and
			 * whether the server accepted the request at all.
			 */
			const streamReply = async (
				request: (callbacks: ChatStreamCallbacks) => Promise<void>,
				onStarted?: () => void,
			): Promise<ReplyOutcome> => {
				const assistantId = crypto.randomUUID();
				set((s) => ({
					messages: [
						...s.messages,
						{ id: assistantId, role: "assistant" as const, content: "" },
					],
					isLoading: true,
					error: null,
				}));

				const outcome: ReplyOutcome = { succeeded: false, started: false };
				const fail = (message: string, status?: number) => {
					outcome.status = status;
					set((s) => ({
						messages: s.messages.filter((m) => m.id !== assistantId),
						isLoading: false,
						error: message,
					}));
				};

				try {
					await request({
						onRunStarted: () => {
							outcome.started = true;
							onStarted?.();
						},
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
							outcome.succeeded = true;
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
				return outcome;
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
					// the server answers any open card with this message instead
					const closeOpenCards = () =>
						set((s) => ({
							messages: s.messages.map((m) =>
								m.role === "card" && m.answer === undefined
									? { ...m, closed: true }
									: m,
							),
						}));
					await streamReply(
						(callbacks) =>
							chatService.sendMessage({ content: trimmed, ...callbacks }),
						closeOpenCards,
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
					if (
						!card ||
						card.answer !== undefined ||
						card.closed ||
						get().isLoading
					) {
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
					const { succeeded, started, status } = await streamReply(
						(callbacks) =>
							chatService.sendToolResult({
								toolCallId,
								content: JSON.stringify({ values }),
								...callbacks,
							}),
					);
					// the server saves the answer before it starts the reply
					if (succeeded || started) {
						return;
					}
					set((s) => ({
						messages: s.messages.map((m) =>
							m.id === card.id
								? // a 409 means the card no longer takes an answer;
									// anything else lets the user submit it again
									{ ...m, answer: undefined, closed: status === 409 }
								: m,
						),
					}));
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
