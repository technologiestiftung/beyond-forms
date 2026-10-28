import { HttpAgent } from "@ag-ui/client";
import type { IChatService, SendMessageOptions } from "./IChatService";
import { env } from "../../config/env.config";
import { useAuthStore } from "../../store/useAuthStore";

function authHeader(): Record<string, string> {
	const token = useAuthStore.getState().token;
	return token ? { Authorization: `Bearer ${token}` } : {};
}

function errorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return "Network error";
	}
	const detail = (error as Error & { payload?: { detail?: unknown } }).payload
		?.detail;
	if (typeof detail === "string") {
		return detail;
	}
	if (Array.isArray(detail)) {
		return detail
			.map(
				(item: Record<string, unknown>) => item?.msg || JSON.stringify(item),
			)
			.join(", ");
	}
	return error.message;
}

export class HttpChatService implements IChatService {
	async sendMessage(options: SendMessageOptions): Promise<void> {
		const { content, onResponse, onDone, onError, signal } = options;
		if (signal?.aborted) {
			return;
		}

		const agent = new HttpAgent({
			url: `${env.VITE_API_URL}/chat/stream`,
			headers: authHeader(),
			fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
		});
		agent.addMessage({ id: crypto.randomUUID(), role: "user", content });

		const abortController = new AbortController();
		signal?.addEventListener("abort", () => abortController.abort(), {
			once: true,
		});

		let text = "";
		let settled = false;
		const fail = (message: string) => {
			if (settled || signal?.aborted) {
				return;
			}
			settled = true;
			onError(message);
		};

		try {
			await agent.runAgent(
				{ abortController },
				{
					// one tool round = one assistant message; keep them in one bubble
					onTextMessageStartEvent: () => {
						if (text) {
							text += "\n\n";
						}
					},
					onTextMessageContentEvent: ({ event }) => {
						text += event.delta;
						onResponse(text);
					},
					onRunFinishedEvent: () => {
						if (!settled) {
							settled = true;
							onDone();
						}
					},
					onRunErrorEvent: ({ event }) => fail(event.message),
					onRunFailed: ({ error }) => fail(errorMessage(error)),
				},
			);
		} catch (e) {
			fail(errorMessage(e));
		}

		fail("Stream connection lost before completion");
	}

	async newChat(): Promise<void> {
		const response = await fetch(`${env.VITE_API_URL}/chat/new`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				...authHeader(),
			},
			credentials: "include",
		});
		if (!response.ok) {
			throw new Error("Failed to start new chat session");
		}
	}
}
