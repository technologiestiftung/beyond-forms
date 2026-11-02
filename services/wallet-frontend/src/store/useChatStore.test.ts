import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatStore, type ChatCardMessage } from "./useChatStore";
import { chatService } from "../services/chat";
import type { ChatStreamCallbacks } from "../services/chat/IChatService";

vi.mock("../services/chat", () => ({
	chatService: {
		sendMessage: vi.fn(),
		sendToolResult: vi.fn(),
		newChat: vi.fn().mockResolvedValue(undefined),
	},
}));

const CARD = {
	card_id: "housing.costs",
	question: "Wie hoch ist Ihre Miete?",
	inputs: [{ field: "rent_total", kind: "amount", label: "Miete" }],
};

const showCard = (args: Record<string, unknown> = CARD) =>
	vi
		.mocked(chatService.sendMessage)
		.mockImplementation(async ({ onResponse, onToolCall, onDone }) => {
			onResponse("Kurz zu Ihrer Wohnung:");
			onToolCall?.({
				toolCallId: "call_card",
				name: "show_card",
				args,
			});
			onDone();
		});

const cards = () =>
	useChatStore
		.getState()
		.messages.filter((m): m is ChatCardMessage => m.role === "card");

describe("useChatStore", () => {
	beforeEach(() => {
		useChatStore.getState().reset();
		vi.clearAllMocks();
	});

	it("should clear messages and invoke chatService.newChat on newChat()", async () => {
		useChatStore.setState({
			messages: [
				{ id: "1", role: "user", content: "Hello" },
				{ id: "2", role: "assistant", content: "Hi" },
			],
		});

		expect(useChatStore.getState().messages.length).toBe(2);

		await useChatStore.getState().newChat();

		expect(chatService.newChat).toHaveBeenCalledOnce();
		expect(useChatStore.getState().messages.length).toBe(0);
		expect(useChatStore.getState().isLoading).toBe(false);
		expect(useChatStore.getState().error).toBeNull();
	});

	it("adds a card after the assistant text when show_card is called", async () => {
		showCard();

		await useChatStore.getState().sendMessage("Wohnkosten");

		expect(useChatStore.getState().messages.map((m) => m.role)).toEqual([
			"user",
			"assistant",
			"card",
		]);
		expect(cards()[0]).toMatchObject({ toolCallId: "call_card", card: CARD });
		expect(cards()[0].answer).toBeUndefined();
	});

	it("ignores show_card calls that are not a valid card", async () => {
		showCard({ card_id: "housing.costs" });

		await useChatStore.getState().sendMessage("Wohnkosten");

		expect(cards()).toEqual([]);
	});

	it("sends the card answer as the tool result and keeps it on the card", async () => {
		showCard();
		await useChatStore.getState().sendMessage("Wohnkosten");
		vi.mocked(chatService.sendToolResult).mockImplementation(
			async ({ onResponse, onDone }: ChatStreamCallbacks) => {
				onResponse("Danke, gespeichert.");
				onDone();
			},
		);

		await useChatStore.getState().answerCard("call_card", { rent_total: 520 });

		expect(chatService.sendToolResult).toHaveBeenCalledWith(
			expect.objectContaining({
				toolCallId: "call_card",
				content: '{"values":{"rent_total":520}}',
			}),
		);
		expect(cards()[0].answer).toEqual({ rent_total: 520 });
		expect(useChatStore.getState().messages.at(-1)).toMatchObject({
			role: "assistant",
			content: "Danke, gespeichert.",
		});
	});

	it("answers a card only once", async () => {
		showCard();
		await useChatStore.getState().sendMessage("Wohnkosten");
		vi.mocked(chatService.sendToolResult).mockImplementation(
			async ({ onDone }: ChatStreamCallbacks) => onDone(),
		);

		await useChatStore.getState().answerCard("call_card", { rent_total: 1 });
		await useChatStore.getState().answerCard("call_card", { rent_total: 1 });

		expect(chatService.sendToolResult).toHaveBeenCalledOnce();
	});

	it("reopens the card when sending the answer fails", async () => {
		showCard();
		await useChatStore.getState().sendMessage("Wohnkosten");
		vi.mocked(chatService.sendToolResult).mockImplementation(
			async ({ onError }: ChatStreamCallbacks) => onError("Network down"),
		);

		await useChatStore.getState().answerCard("call_card", { rent_total: 1 });

		expect(cards()[0].answer).toBeUndefined();
		expect(useChatStore.getState().error).toBe("Network down");
	});

	it("keeps the answer when the reply fails after the server saved it", async () => {
		showCard();
		await useChatStore.getState().sendMessage("Wohnkosten");
		vi.mocked(chatService.sendToolResult).mockImplementation(
			async ({ onRunStarted, onError }: ChatStreamCallbacks) => {
				onRunStarted?.();
				onError("Streaming Error");
			},
		);

		await useChatStore.getState().answerCard("call_card", { rent_total: 1 });

		expect(cards()[0].answer).toEqual({ rent_total: 1 });
	});

	it("closes a card the server no longer takes an answer for", async () => {
		showCard();
		await useChatStore.getState().sendMessage("Wohnkosten");
		vi.mocked(chatService.sendToolResult).mockImplementation(
			async ({ onError }: ChatStreamCallbacks) =>
				onError("This card has already been answered", 409),
		);

		await useChatStore.getState().answerCard("call_card", { rent_total: 1 });

		expect(cards()[0]).toMatchObject({ answer: undefined, closed: true });
	});

	it("closes open cards once a typed message reaches the server", async () => {
		showCard();
		await useChatStore.getState().sendMessage("Wohnkosten");
		vi.mocked(chatService.sendMessage).mockImplementation(
			async ({ onRunStarted, onDone }: ChatStreamCallbacks) => {
				onRunStarted?.();
				onDone();
			},
		);

		await useChatStore.getState().sendMessage("Lieber so: 520 Euro");

		expect(cards()[0].closed).toBe(true);
	});
});
