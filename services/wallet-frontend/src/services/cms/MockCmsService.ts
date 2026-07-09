import type { ICmsService } from "./ICmsService";
import type {
	TutorialResponse,
	TutorialProgressUpdatePayload,
} from "../../schemas/cms.schema";
import { ONBOARDING_TUTORIAL_SLUGS } from "../../constants/onboardingTutorials";

export class MockCmsService implements ICmsService {
	private mockTutorials: TutorialResponse[] = [
		{
			id: "c8f4a2b1-9e3d-4c7f-a8b6-2d1e0f9c8b7a",
			slug: ONBOARDING_TUTORIAL_SLUGS.basicIncome,
			title: {
				de: "Was ist Grundsicherung?",
				en: "What is basic income?",
			},
			subtitle: {
				de: "Hier findest Du die wichtigsten Infos.",
				en: "Here you'll find the key information.",
			},
			progress: { status: "not_started", current_step: null },
			steps: [
				{
					step_id: "step-1",
					content: {
						de: {
							title: "Was ist Grundsicherung?",
							text: "Grundsicherung ist eine finanzielle Unterstützung. Sie kann helfen, wenn Du in der Altersrente bist oder aus gesundheitlichen Gründen nicht mehr arbeiten kannst und Dein Geld für den Lebensunterhalt nicht reicht.\n\nMit Grundsicherung können zum Beispiel Kosten für den Alltag, die Wohnung und das Heizen unterstützt werden.",
						},
						en: {
							title: "What is basic income?",
							text: "Basic income is financial support. It can help if you are at retirement age or cannot work for health reasons and your money is not enough for living costs.\n\nWith basic income, support can be provided for daily costs, housing, and heating, for example.",
						},
					},
				},
			],
		},
		{
			id: "8d8f41b2-c022-4a21-bc53-5d212eef32f1",
			slug: ONBOARDING_TUTORIAL_SLUGS.appGuide,
			title: {
				de: "Wie funktioniert die Applikation?",
				en: "How does the application work?",
			},
			subtitle: {
				de: "Hier findest Du eine einfache Anleitung.",
				en: "Here you'll find a simple guide.",
			},
			progress: { status: "not_started", current_step: null },
			steps: [
				{
					step_id: "step-1",
					image: "tutorial-app-guide-step-1",
					content: {
						de: {
							title: "Schritt-für-Schritt zum Antrag.",
							text: "Vollständige Anträge können schneller von der Verwaltung bearbeitet werden.\n\nKlaros Fortschrittsanzeige zeigt Dir, was Du schon erledigt hast und was noch zu tun ist. So weißt Du jederzeit, wie weit Du bist.",
						},
						en: {
							title: "Step-by-step to the application.",
							text: "Complete applications can be processed faster by the administration.\n\nKlaro's progress indicator shows you what you have already done and what still needs to be done. So you know at all times how far you are.",
						},
					},
				},
				{
					step_id: "step-2",
					image: "tutorial-app-guide-step-2",
					content: {
						de: {
							title: "Deine Fortschritte werden gespeichert.",
							text: "Dein Fortschritt wird automatisch gespeichert. So kannst Du Deinen Antragsprozess jederzeit unterbrechen und später fortsetzen.",
						},
						en: {
							title: "Your progress is saved.",
							text: "Your progress is automatically saved. So you can interrupt your application process at any time and continue later.",
						},
					},
				},
				{
					step_id: "step-3",
					image: "tutorial-app-guide-step-3",
					content: {
						de: {
							title: "Intelligente Dokumentanalyse",
							text: "Wenn Du die Daten im Antrag nicht manuell ausfüllen möchtest, kannst Du uns stattdessen ein Dokument geben. Klaro analysiert das Dokument, findet für den Antrag relevante Informationen und speichert sie. Diese Funktion findest Du direkt am Anfang Deines Antrags.",
						},
						en: {
							title: "Intelligent Document Analysis",
							text: "If you do not want to fill in the data in the application manually, you can give us a document instead. Klaro analyzes the document, finds relevant info and saves it. You can find this at the start of your application.",
						},
					},
				},
				{
					step_id: "step-4",
					image: "tutorial-app-guide-step-4",
					content: {
						de: {
							title: "Dein persönlicher Assistent",
							text: 'Du brauchst Hilfe beim Ausfüllen des Antrags oder hast eine Frage zu Deinem Sozialhilfe-Anspruch? Der Klaro-Assistent beantwortet Dir Deine Fragen und ist nur einen Klick auf das "Chat"-Icon entfernt.',
						},
						en: {
							title: "Your Personal Assistant",
							text: "Need help filling out the application or have a question about your basic income entitlement? The Klaro assistant answers your questions and is just a click away on the chat icon.",
						},
					},
				},
			],
		},
	];

	private getStorageKey(): string {
		if (typeof window === "undefined") {
			return "beyond-forms-mock-tutorials-default";
		}
		let phone = "";
		const persisted = sessionStorage.getItem("beyond-forms-auth-session");
		if (persisted) {
			try {
				const parsed = JSON.parse(persisted);
				phone = parsed.state?.phoneNumber || "";
			} catch {
				// Ignore
			}
		}
		const cleanPhone = phone ? phone.replace(/[^a-zA-Z0-9+]/g, "") : "default";
		return `beyond-forms-mock-tutorials-${cleanPhone}`;
	}

	private getStoredTutorials(): TutorialResponse[] {
		if (typeof window === "undefined") {
			return this.mockTutorials;
		}
		const stored = localStorage.getItem(this.getStorageKey());
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {
				// Ignore parse errors and fall back
			}
		}
		return this.mockTutorials;
	}

	private saveTutorials(tutorials: TutorialResponse[]) {
		if (typeof window !== "undefined") {
			localStorage.setItem(this.getStorageKey(), JSON.stringify(tutorials));
		}
	}

	async getMyTutorials(): Promise<TutorialResponse[]> {
		return this.getStoredTutorials();
	}

	async updateTutorialProgress(
		payload: TutorialProgressUpdatePayload,
	): Promise<{ status: string }> {
		const current = this.getStoredTutorials();
		const tutorial = current.find((t) => t.id === payload.tutorial_id);
		if (tutorial) {
			tutorial.progress.status = payload.status;
			tutorial.progress.current_step = payload.current_step || null;
			this.saveTutorials(current);
		}
		return { status: "success" };
	}
}
