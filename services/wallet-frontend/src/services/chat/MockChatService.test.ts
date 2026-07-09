import { describe, it, expect, beforeEach } from "vitest";
import { MockChatService } from "./MockChatService";

describe("MockChatService", () => {
	let service: MockChatService;

	beforeEach(() => {
		service = new MockChatService();
	});

	it("returns full reply and calls onDone", async () => {
		let reply = "";
		let done = false;
		await service.sendMessage({
			content: "Hi",
			onResponse: (r) => {
				reply = r;
			},
			onDone: () => {
				done = true;
			},
			onError: () => {
				throw new Error("unexpected error");
			},
		});

		expect(reply.length).toBeGreaterThan(0);
		expect(done).toBe(true);
	});

	it("calls onError when already aborted at start", async () => {
		const controller = new AbortController();
		controller.abort();

		let err: string | null = null;
		await service.sendMessage({
			content: "Hi",
			signal: controller.signal,
			onResponse: () => {},
			onDone: () => {},
			onError: (e) => {
				err = e;
			},
		});

		expect(err).toBe("Aborted");
	});
});
