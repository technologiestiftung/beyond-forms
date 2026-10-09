import type { IChatService, SendMessageOptions } from "./IChatService";
import i18n from "../../i18n";
import { event, newSurface, type A2uiMessage } from "../../a2ui/messages";

const MOCK_REPLIES = [
	"Das kann ich Dir gern erklären. Grundsicherung richtet sich u. a. an Personen, die erwerbsgemindert sind und Hilfe zum Lebensunterhalt brauchen.",
	"Hier ein kurzer Überblick: Du kannst Schritte im Profil ergänzen und fehlende Angaben nachreichen.",
	"Ich bin eine Demo-Antwort. Sobald das Backend verbunden ist, ersetzt diese Nachricht die echte KI-Antwort.",
];

const ELIGIBILITY_INTENT =
	/anspruch|bekommen|leistung|unterstützung|entitled|eligib|support/i;

const DOCUMENTS_INTENT = /unterlagen|dokumente|documents/i;

/** A view as the model might compose it with the backend's `show_view` tool. */
const documentsView = (): A2uiMessage[] =>
	newSurface("generated-view", [
		{ id: "root", component: "Card", child: "content" },
		{
			id: "content",
			component: "Column",
			children: ["title", "intro", "list", "compare", "next"],
		},
		{
			id: "title",
			component: "Text",
			variant: "title",
			text: "Diese Unterlagen brauchst Du meistens",
		},
		{
			id: "intro",
			component: "Text",
			variant: "muted",
			text: "Hake ab, was Du schon hast. Die genaue Liste hängt von der Leistung ab.",
		},
		{
			id: "list",
			component: "Checklist",
			items: [
				{ label: "Personalausweis oder Pass" },
				{ label: "Mietvertrag", hint: "mit aktueller Miethöhe" },
				{ label: "Kontoauszüge", hint: "der letzten drei Monate" },
				{
					label: "Nachweise über Einkommen",
					hint: "z. B. Lohnabrechnung, Rentenbescheid",
				},
			],
		},
		{
			id: "compare",
			component: "Table",
			columns: ["Unterlage", "Wohngeld", "Grundsicherungsgeld"],
			rows: [
				["Mietvertrag", "ja", "ja"],
				["Kontoauszüge", "manchmal", "ja"],
				["Nachweis über Vermögen", "nein", "ja"],
			],
		},
		{ id: "next", component: "Row", children: ["ask-office", "ask-upload"] },
		{
			id: "ask-office",
			component: "Chip",
			label: "Wo gebe ich das ab?",
			action: event("send_text", { text: "Wo gebe ich die Unterlagen ab?" }),
		},
		{
			id: "ask-upload",
			component: "Chip",
			label: "Kann ich das hochladen?",
			action: event("send_text", {
				text: "Kann ich die Unterlagen hochladen?",
			}),
		},
	]);

/** The consent card as the backend's `start_eligibility_check` tool sends it. */
const consentSurface = (): A2uiMessage[] => {
	const t = (key: string) => i18n.t(`guided.consent.${key}`, { ns: "chat" });
	return newSurface("eligibility-consent", [
		{ id: "root", component: "Card", child: "content" },
		{
			id: "content",
			component: "Column",
			children: ["title", "goal", "scope", "privacy", "actions"],
		},
		{ id: "title", component: "Text", variant: "title", text: t("title") },
		{ id: "goal", component: "Fact", label: t("goal_label"), text: t("goal") },
		{
			id: "scope",
			component: "Fact",
			label: t("scope_label"),
			text: t("scope"),
		},
		{
			id: "privacy",
			component: "Fact",
			label: t("privacy_label"),
			text: t("privacy"),
		},
		{ id: "actions", component: "Row", children: ["start", "later"] },
		{
			id: "start",
			component: "Chip",
			variant: "solid",
			label: t("start"),
			action: event("start_check"),
		},
		{
			id: "later",
			component: "Chip",
			label: t("later"),
			action: event("decline_check"),
		},
	]);
};

/**
 * Local mock: returns a canned assistant reply as a single synchronous response.
 * It imitates the backend UI tools: an eligibility question sends the consent card,
 * and a number typed during the check is recorded for the current question.
 */
export class MockChatService implements IChatService {
	private replyIndex = 0;

	async sendMessage(options: SendMessageOptions): Promise<void> {
		const {
			content,
			guidedCheck,
			onResponse,
			onA2ui,
			onEligibilityAnswer,
			onDone,
			onError,
			signal,
		} = options;
		if (signal?.aborted) {
			onError("Aborted");
			return;
		}

		const amount = content.match(/\d+/)?.[0];
		if (guidedCheck?.currentField && amount) {
			onEligibilityAnswer?.({ field: guidedCheck.currentField, value: amount });
			onResponse("Danke, das habe ich mir vorläufig notiert.");
			onDone();
			return;
		}

		if (DOCUMENTS_INTENT.test(content)) {
			onResponse("Hier eine Übersicht, die Du abhaken kannst.");
			documentsView().forEach((message) => onA2ui?.(message));
			onDone();
			return;
		}

		if (!guidedCheck && ELIGIBILITY_INTENT.test(content)) {
			onResponse("Das finden wir am besten gemeinsam heraus.");
			consentSurface().forEach((message) => onA2ui?.(message));
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
