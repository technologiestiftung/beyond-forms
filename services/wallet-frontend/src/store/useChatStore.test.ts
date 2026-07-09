import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatStore } from "./useChatStore";
import { chatService } from "../services/chat";

vi.mock("../services/chat", () => ({
	chatService: {
		sendMessage: vi.fn(),
		newChat: vi.fn().mockResolvedValue(undefined),
	},
}));

describe("useChatStore", () => {
	beforeEach(() => {
		useChatStore.getState().reset();
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
});
