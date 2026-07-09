import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpChatService } from "./HttpChatService";
import { env } from "../../config/env.config";

vi.mock("../../store/useAuthStore", () => ({
	useAuthStore: {
		getState: () => ({ token: "mock-token" }),
	},
}));

vi.mock("../../config/env.config", () => ({
	env: {
		VITE_API_URL: "/api",
		VITE_USE_MOCKS: false,
		VITE_USE_MOCK_AUTH: false,
		VITE_BYPASS_AUTH: false,
		VITE_AUTH_URL: "/auth-proxy",
	},
}));

function streamResponse(chunks: string[]): Response {
	const encoder = new TextEncoder();
	const queue = chunks.map((c) => encoder.encode(c));
	return {
		ok: true,
		status: 200,
		body: {
			getReader: () => ({
				read: async () => {
					const value = queue.shift();
					return value
						? { value, done: false }
						: { value: undefined, done: true };
				},
				cancel: async () => {},
			}),
		},
		json: () => Promise.resolve({}),
	} as unknown as Response;
}

describe("HttpChatService", () => {
	let service: HttpChatService;

	beforeEach(() => {
		service = new HttpChatService();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("POSTs to /chat/stream with NDJSON Accept and auth headers", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				'{"type":"token","content":"Hi"}\n',
				'{"type":"done","conversation_id":"abc"}\n',
			]),
		);

		await service.sendMessage({
			content: "Hi",
			onResponse: () => {},
			onDone: () => {},
			onError: () => {
				throw new Error("unexpected error");
			},
		});

		expect(fetch).toHaveBeenCalledWith(
			`${env.VITE_API_URL}/chat/stream`,
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Accept: "application/x-ndjson",
					Authorization: "Bearer mock-token",
				}),
				body: JSON.stringify({ content: "Hi" }),
			}),
		);
	});

	it("accumulates token chunks and calls onDone once when done is received", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				'{"type":"token","content":"Hel"}\n',
				'{"type":"token","content":"lo"}\n{"type":"done","conversation_id":"abc"}\n',
			]),
		);

		const responses: string[] = [];
		const onDone = vi.fn();
		const onError = vi.fn();

		await service.sendMessage({
			content: "x",
			onResponse: (r) => {
				responses.push(r);
			},
			onDone,
			onError,
		});

		expect(responses).toEqual(["Hel", "Hello"]);
		expect(onDone).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});

	it("buffers partial NDJSON lines across read chunks", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				'{"type":"to',
				'ken","content":"hi"}\n{"type":"done","con',
				'versation_id":"abc"}\n',
			]),
		);

		const responses: string[] = [];
		const onDone = vi.fn();

		await service.sendMessage({
			content: "x",
			onResponse: (r) => responses.push(r),
			onDone,
			onError: () => {},
		});

		expect(responses).toEqual(["hi"]);
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("ignores malformed lines and still processes valid NDJSON", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				"not-json\n",
				'{"type":"token","content":"ok"}\n',
				'{"type":"done","conversation_id":"abc"}\n',
			]),
		);

		const responses: string[] = [];
		const onDone = vi.fn();
		const onError = vi.fn();

		await service.sendMessage({
			content: "x",
			onResponse: (r) => responses.push(r),
			onDone,
			onError,
		});

		expect(responses).toEqual(["ok"]);
		expect(onDone).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});

	it("calls onError for type error with message and not onDone", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse(['{"type":"error","content":"Streaming error"}\n']),
		);

		const onDone = vi.fn();
		const onError = vi.fn();

		await service.sendMessage({
			content: "x",
			onResponse: () => {},
			onDone,
			onError,
		});

		expect(onError).toHaveBeenCalledWith("Streaming error");
		expect(onDone).not.toHaveBeenCalled();
	});

	it("uses default message when error event has no content", async () => {
		vi.mocked(fetch).mockResolvedValue(streamResponse(['{"type":"error"}\n']));

		const onError = vi.fn();

		await service.sendMessage({
			content: "x",
			onResponse: () => {},
			onDone: () => {},
			onError,
		});

		expect(onError).toHaveBeenCalledWith("Streaming error");
	});

	it("calls onError when response is not ok", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			status: 401,
			statusText: "Unauthorized",
			json: () => Promise.resolve({ detail: "Invalid token" }),
		} as Response);

		const onError = vi.fn();

		await service.sendMessage({
			content: "Hi",
			onResponse: () => {},
			onDone: () => {},
			onError,
		});

		expect(onError).toHaveBeenCalledWith("Invalid token");
	});

	it("calls onError when fetch rejects", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network down"));

		const onError = vi.fn();

		await service.sendMessage({
			content: "Hi",
			onResponse: () => {},
			onDone: () => {},
			onError,
		});

		expect(onError).toHaveBeenCalledWith("Network down");
	});

	it("calls onError when response body has no reader", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			status: 200,
			body: undefined,
			json: () => Promise.resolve({}),
		} as unknown as Response);

		const onError = vi.fn();

		await service.sendMessage({
			content: "x",
			onResponse: () => {},
			onDone: () => {},
			onError,
		});

		expect(onError).toHaveBeenCalledWith("Stream not available");
	});

	it("calls onError when reader.read rejects after a token", async () => {
		const encoder = new TextEncoder();
		let readCount = 0;
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			status: 200,
			body: {
				getReader: () => ({
					read: async () => {
						if (readCount++ === 0) {
							return {
								value: encoder.encode('{"type":"token","content":"x"}\n'),
								done: false,
							};
						}
						throw new Error("boom");
					},
					cancel: async () => {},
				}),
			},
			json: () => Promise.resolve({}),
		} as unknown as Response);

		const onDone = vi.fn();
		const onError = vi.fn();

		await service.sendMessage({
			content: "x",
			onResponse: () => {},
			onDone,
			onError,
		});

		expect(onError).toHaveBeenCalledWith("boom");
		expect(onDone).not.toHaveBeenCalled();
	});
});
