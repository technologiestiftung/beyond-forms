import { HttpChatService } from "./HttpChatService";
import { MockChatService } from "./MockChatService";
import type { IChatService } from "./IChatService";
import { env } from "../../config/env.config";

/**
 * Factory module that resolves the correct ChatService implementation
 * based on environment configuration.
 */
export const chatService: IChatService =
	env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH
		? new MockChatService()
		: new HttpChatService();

export * from "./IChatService";
