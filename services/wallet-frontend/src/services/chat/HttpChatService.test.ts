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

const sse = (event: Record<string, unknown>) =>
	`data: ${JSON.stringify(event)}\n\n`;

const RUN_STARTED = sse({ type: "RUN_STARTED", threadId: "t", runId: "r" });
const RUN_FINISHED = sse({ type: "RUN_FINISHED", threadId: "t", runId: "r" });
const chunk = (messageId: string, delta: string) =>
	sse({ type: "TEXT_MESSAGE_CHUNK", messageId, delta });

function streamResponse(parts: string[]): Response {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const part of parts) {
				controller.enqueue(encoder.encode(part));
			}
			controller.close();
		},
	});
	return new Response(body, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});
}

function send(service: HttpChatService, signal?: AbortSignal) {
	const responses: string[] = [];
	const onDone = vi.fn();
	const onError = vi.fn();
	const done = service.sendMessage({
		content: "Hi",
		onResponse: (r) => responses.push(r),
		onDone,
		onError,
		signal,
	});
	return { done, responses, onDone, onError };
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

	it("POSTs the user message as RunAgentInput with SSE Accept and auth headers", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([RUN_STARTED, RUN_FINISHED]),
		);

		const { done, onError } = send(service);
		await done;

		expect(onError).not.toHaveBeenCalled();
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe(`${env.VITE_API_URL}/chat/stream`);
		expect(init).toEqual(
			expect.objectContaining({
				method: "POST",
				credentials: "include",
				headers: expect.objectContaining({
					Accept: "text/event-stream",
					Authorization: "Bearer mock-token",
				}),
			}),
		);
		const body = JSON.parse(init?.body as string);
		expect(body.messages).toEqual([
			expect.objectContaining({ role: "user", content: "Hi" }),
		]);
	});

	it("accumulates text chunks and calls onDone once", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				RUN_STARTED,
				chunk("m1", "Hel"),
				chunk("m1", "lo"),
				RUN_FINISHED,
			]),
		);

		const { done, responses, onDone, onError } = send(service);
		await done;

		expect(responses).toEqual(["Hel", "Hello"]);
		expect(onDone).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});

	it("separates assistant messages from different tool rounds", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				RUN_STARTED,
				chunk("m1", "Moment."),
				chunk("m2", "Fertig."),
				RUN_FINISHED,
			]),
		);

		const { done, responses } = send(service);
		await done;

		expect(responses.at(-1)).toBe("Moment.\n\nFertig.");
	});

	it("buffers SSE events split across reads", async () => {
		const events = RUN_STARTED + chunk("m1", "hi") + RUN_FINISHED;
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				events.slice(0, 30),
				events.slice(30, 90),
				events.slice(90),
			]),
		);

		const { done, responses, onDone } = send(service);
		await done;

		expect(responses).toEqual(["hi"]);
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("calls onError with the RUN_ERROR message and not onDone", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				RUN_STARTED,
				sse({ type: "RUN_ERROR", message: "Streaming error" }),
			]),
		);

		const { done, onDone, onError } = send(service);
		await done;

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledWith("Streaming error");
		expect(onDone).not.toHaveBeenCalled();
	});

	it("uses the response detail when the request is rejected", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ detail: "Invalid token" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { done, onError } = send(service);
		await done;

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledWith("Invalid token");
	});

	it("joins validation error details", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					detail: [{ msg: "field required" }, { msg: "too long" }],
				}),
				{ status: 422, headers: { "Content-Type": "application/json" } },
			),
		);

		const { done, onError } = send(service);
		await done;

		expect(onError).toHaveBeenCalledWith("field required, too long");
	});

	it("calls onError when fetch rejects", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network down"));

		const { done, onError } = send(service);
		await done;

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledWith("Network down");
	});

	it("calls onError when the stream ends without RUN_FINISHED", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([RUN_STARTED, chunk("m1", "x")]),
		);

		const { done, onDone, onError } = send(service);
		await done;

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onDone).not.toHaveBeenCalled();
	});

	it("stays silent when the caller aborts", async () => {
		const controller = new AbortController();
		vi.mocked(fetch).mockImplementation(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					const abort = () => reject(new DOMException("Aborted", "AbortError"));
					if (init?.signal?.aborted) {
						abort();
					}
					init?.signal?.addEventListener("abort", abort);
				}),
		);

		const { done, onDone, onError } = send(service, controller.signal);
		controller.abort();
		await done;

		expect(onError).not.toHaveBeenCalled();
		expect(onDone).not.toHaveBeenCalled();
	});

	it("reports a show_card call after the lead-in text", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([
				RUN_STARTED,
				chunk("m1", "Kurz zu Ihrer Wohnung:"),
				sse({
					type: "TOOL_CALL_CHUNK",
					toolCallId: "call_card",
					toolCallName: "show_card",
					parentMessageId: "m1",
					delta: '{"card_id": "housing.costs"}',
				}),
				RUN_FINISHED,
			]),
		);
		const onToolCall = vi.fn();
		const onDone = vi.fn();

		await service.sendMessage({
			content: "Wohnkosten",
			onResponse: () => {},
			onToolCall,
			onDone,
			onError: () => {},
		});

		expect(onToolCall).toHaveBeenCalledWith({
			toolCallId: "call_card",
			name: "show_card",
			args: { card_id: "housing.costs" },
		});
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("sends a card answer as the tool message", async () => {
		vi.mocked(fetch).mockResolvedValue(
			streamResponse([RUN_STARTED, chunk("m1", "Danke."), RUN_FINISHED]),
		);
		const responses: string[] = [];

		await service.sendToolResult({
			toolCallId: "call_card",
			content: '{"card_id":"housing.costs"}',
			onResponse: (r) => responses.push(r),
			onDone: () => {},
			onError: () => {},
		});

		const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
		expect(body.messages).toEqual([
			expect.objectContaining({
				role: "tool",
				toolCallId: "call_card",
				content: '{"card_id":"housing.costs"}',
			}),
		]);
		expect(responses).toEqual(["Danke."]);
	});
});
