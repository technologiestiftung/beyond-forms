import type { IChatService, SendMessageOptions } from "./IChatService";

const MOCK_REPLIES = [
	"Das kann ich Dir gern erklären. Grundsicherung richtet sich u. a. an Personen, die erwerbsgemindert sind und Hilfe zum Lebensunterhalt brauchen.",
	"Hier ein kurzer Überblick: Du kannst Schritte im Profil ergänzen und fehlende Angaben nachreichen.",
	"Ich bin eine Demo-Antwort. Sobald das Backend verbunden ist, ersetzt diese Nachricht die echte KI-Antwort.",
];

/**
 * Local mock: returns a canned assistant reply as a single synchronous response.
 */
export class MockChatService implements IChatService {
	private replyIndex = 0;

	async sendMessage(options: SendMessageOptions): Promise<void> {
		const { onResponse, onDone, onError, signal } = options;
		if (signal?.aborted) {
			onError("Aborted");
			return;
		}
		const text =
			MOCK_REPLIES[this.replyIndex % MOCK_REPLIES.length] ?? MOCK_REPLIES[0];
		this.replyIndex += 1;

		onResponse(text);
		onDone();
	}

	async newChat(): Promise<void> {
		this.replyIndex = 0;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}
