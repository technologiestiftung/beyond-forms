import type { IChatService, SendMessageOptions } from "./IChatService";
import { ServerUiComponent } from "../../schemas/chat.schema";

const MOCK_REPLIES = [
	"Das kann ich Dir gern erklären. Grundsicherung richtet sich u. a. an Personen, die erwerbsgemindert sind und Hilfe zum Lebensunterhalt brauchen.",
	"Hier ein kurzer Überblick: Du kannst Schritte im Profil ergänzen und fehlende Angaben nachreichen.",
	"Ich bin eine Demo-Antwort. Sobald das Backend verbunden ist, ersetzt diese Nachricht die echte KI-Antwort.",
];

const ELIGIBILITY_INTENT = /anspruch|bekommen|leistung|entitled|eligib/i;

/**
 * Local mock: returns a canned assistant reply as a single synchronous response.
 * It imitates the backend UI tools: an eligibility question starts the guided check,
 * and a number typed during the check is recorded for the current question.
 */
export class MockChatService implements IChatService {
	private replyIndex = 0;

	async sendMessage(options: SendMessageOptions): Promise<void> {
		const { content, guidedCheck, onResponse, onUi, onDone, onError, signal } =
			options;
		if (signal?.aborted) {
			onError("Aborted");
			return;
		}

		const amount = content.match(/\d+/)?.[0];
		if (guidedCheck?.currentField && amount) {
			onUi?.({
				component: ServerUiComponent.ELIGIBILITY_ANSWER,
				props: { field: guidedCheck.currentField, value: amount },
			});
			onResponse("Danke, das habe ich mir vorläufig notiert.");
			onDone();
			return;
		}

		if (!guidedCheck && ELIGIBILITY_INTENT.test(content)) {
			onResponse("Das finden wir am besten gemeinsam heraus.");
			onUi?.({ component: ServerUiComponent.ELIGIBILITY_CONSENT, props: {} });
			onDone();
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
