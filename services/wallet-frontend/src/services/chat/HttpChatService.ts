import type { IChatService, SendMessageOptions } from "./IChatService";
import { env } from "../../config/env.config";
import { useAuthStore } from "../../store/useAuthStore";
import { ChatStreamChunkSchema } from "../../schemas/chat.schema";

function chatRequestHeaders(
	accept = "application/x-ndjson",
): Record<string, string> {
	const token = useAuthStore.getState().token;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Accept: accept,
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	return headers;
}

function parseNdjsonLine(line: string): unknown | null {
	const trimmed = line.trim();
	if (!trimmed) {
		return null;
	}
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

function handleChunk(
	parsed: unknown,
	handler: {
		onToken: (content: string) => void;
		onDone: () => void;
		onError: (message: string) => void;
	},
): boolean {
	const result = ChatStreamChunkSchema.safeParse(parsed);
	if (!result.success) {
		return false;
	}
	const chunk = result.data;
	if (chunk.type === "token" && chunk.content) {
		handler.onToken(chunk.content);
		return false;
	}
	if (chunk.type === "done") {
		handler.onDone();
		return true;
	}
	if (chunk.type === "error") {
		handler.onError(chunk.content || "Streaming error");
		return true;
	}
	return false;
}

export class HttpChatService implements IChatService {
	private processLine(
		line: string,
		handler: {
			onToken: (content: string) => void;
			onDone: () => void;
			onError: (message: string) => void;
		},
		reader: ReadableStreamDefaultReader<Uint8Array>,
	): boolean {
		const parsed = parseNdjsonLine(line);
		if (parsed === null) {
			return false;
		}
		if (handleChunk(parsed, handler)) {
			void reader.cancel();
			return true;
		}
		return false;
	}

	private async handleStreamRead(options: {
		reader: ReadableStreamDefaultReader<Uint8Array>;
		decoder: TextDecoder;
		handler: {
			onToken: (content: string) => void;
			onDone: () => void;
			onError: (message: string) => void;
		};
		buffer: string;
	}): Promise<{ done: boolean; buffer: string }> {
		const { reader, decoder, handler } = options;
		let { buffer } = options;
		const { done, value } = await reader.read();

		if (value) {
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const res = this.processLine(line, handler, reader);
				if (res) {
					return { done: true, buffer };
				}
			}
		}

		return { done, buffer };
	}

	private async handleStream(options: {
		reader: ReadableStreamDefaultReader<Uint8Array>;
		onResponse: (msg: string) => void;
		onDone: () => void;
		onError: (err: string) => void;
		signal?: AbortSignal;
	}) {
		const { reader, onResponse, onDone, onError, signal } = options;
		const decoder = new TextDecoder();
		let accumulated = "";
		let hasFinished = false;
		const handler = {
			onToken: (tokenContent: string) => {
				accumulated += tokenContent;
				onResponse(accumulated);
			},
			onDone: () => {
				hasFinished = true;
				onDone();
			},
			onError: (message: string) => {
				hasFinished = true;
				onError(message);
			},
		};

		let buffer = "";
		try {
			while (true) {
				const result = await this.handleStreamRead({
					reader,
					decoder,
					handler,
					buffer,
				});
				buffer = result.buffer;

				if (result.done) {
					if (buffer.trim() && this.processLine(buffer, handler, reader)) {
						return;
					}
					break;
				}
			}
		} catch (e) {
			void reader.cancel();
			if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) {
				return;
			}
			onError(e instanceof Error ? e.message : "Stream read error");
			return;
		}

		if (!hasFinished) {
			onError("Stream connection lost before completion");
		}
	}

	async sendMessage(options: SendMessageOptions): Promise<void> {
		const { content, onResponse, onDone, onError, signal } = options;
		let response: Response;
		try {
			response = await fetch(`${env.VITE_API_URL}/chat/stream`, {
				method: "POST",
				headers: chatRequestHeaders("application/x-ndjson"),
				credentials: "include",
				body: JSON.stringify({ content }),
				signal,
			});
		} catch (e) {
			if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) {
				return;
			}
			onError(e instanceof Error ? e.message : "Network error");
			return;
		}

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as {
				detail?: unknown;
			};
			let fromDetail: string | undefined;
			if (typeof errorData.detail === "string") {
				fromDetail = errorData.detail;
			} else if (Array.isArray(errorData.detail)) {
				fromDetail = errorData.detail
					.map(
						(item: Record<string, unknown>) =>
							item?.msg || JSON.stringify(item),
					)
					.join(", ");
			}
			onError(
				fromDetail ||
					response.statusText ||
					`Request failed (${response.status})`,
			);
			return;
		}

		const reader = response.body?.getReader();
		if (!reader) {
			onError("Stream not available");
			return;
		}

		await this.handleStream({ reader, onResponse, onDone, onError, signal });
	}

	async newChat(): Promise<void> {
		const response = await fetch(`${env.VITE_API_URL}/chat/new`, {
			method: "POST",
			headers: chatRequestHeaders("application/json"),
			credentials: "include",
		});
		if (!response.ok) {
			throw new Error("Failed to start new chat session");
		}
	}
}
