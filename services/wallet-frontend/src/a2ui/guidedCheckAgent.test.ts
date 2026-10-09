import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore, type ChatMessage } from "../store/useChatStore";
import { useEligibilityStore } from "../store/useEligibilityStore";
import { useGuidedCheckStore } from "../store/useGuidedCheckStore";
import {
	handleA2uiAction,
	handleEligibilityAnswer,
	showNextGuidedStep,
} from "./guidedCheckAgent";
import { a2uiProcessor } from "./processor";
import { event, newSurface } from "./messages";

type A2uiChatMessage = Extract<ChatMessage, { role: "a2ui" }>;

const surfaces = () =>
	useChatStore
		.getState()
		.messages.filter((m): m is A2uiChatMessage => m.role === "a2ui");

const lastSurface = () => surfaces()[surfaces().length - 1];

const componentsOf = (message: A2uiChatMessage) =>
	message.messages.flatMap((m) =>
		"updateComponents" in m ? m.updateComponents.components : [],
	);

const action = (
	name: string,
	surfaceId: string,
	context: Record<string, unknown> = {},
) =>
	handleA2uiAction({
		name,
		surfaceId,
		sourceComponentId: "test",
		timestamp: new Date().toISOString(),
		context,
	});

const showConsent = () => {
	useChatStore.getState().applyA2ui(
		newSurface("eligibility-consent", [
			{ id: "root", component: "Row", children: ["actions"] },
			{ id: "actions", component: "Row", children: ["start"] },
			{
				id: "start",
				component: "Chip",
				label: "Los",
				action: event("start_check"),
			},
		]),
	);
	return lastSurface().surfaceId;
};

describe("guidedCheckAgent", () => {
	beforeEach(() => {
		useChatStore.getState().reset();
		useGuidedCheckStore.getState().reset();
		useEligibilityStore.getState().resetForm();
	});

	it("starts the check from the consent card and shows the first question", () => {
		const consentId = showConsent();

		action("start_check", consentId);

		expect(useGuidedCheckStore.getState().isActive).toBe(true);
		expect(lastSurface().surfaceId).toMatch(/^eligibility-question-/);
		expect(componentsOf(lastSurface()).map((c) => c.id)).toContain(
			"option-SINGLE",
		);
		expect(a2uiProcessor.getSurface(lastSurface().surfaceId)).toBeDefined();
	});

	it("turns an answered card into a summary and moves on", () => {
		action("start_check", showConsent());
		const questionId = lastSurface().surfaceId;

		action("answer", questionId, {
			field: "householdComposition",
			value: "SINGLE",
		});

		const answered = surfaces().filter((s) => s.surfaceId === questionId);
		expect(answered.flatMap(componentsOf).at(-1)).toMatchObject({
			id: "root",
			component: "AnswerSummary",
		});
		expect(useEligibilityStore.getState().answers.householdComposition).toBe(
			"SINGLE",
		);
		expect(lastSurface().surfaceId).not.toBe(questionId);
	});

	it("ignores answers that do not fit the field", () => {
		action("start_check", showConsent());
		const questionId = lastSurface().surfaceId;

		action("answer", questionId, {
			field: "householdComposition",
			value: "EVERYONE",
		});

		expect(lastSurface().surfaceId).toBe(questionId);
	});

	it("notes a provisional answer from free text", () => {
		action("start_check", showConsent());

		handleEligibilityAnswer({ field: "monthlyWarmRent", value: "650" });

		expect(useEligibilityStore.getState().answers.monthlyWarmRent).toBe(650);
		expect(useGuidedCheckStore.getState().provisionalFields).toEqual([
			"monthlyWarmRent",
		]);
		expect(lastSurface().surfaceId).toMatch(/^eligibility-noted-/);
	});

	it("replaces an open question when the next step is shown", () => {
		action("start_check", showConsent());
		const questionId = lastSurface().surfaceId;

		showNextGuidedStep();

		const questions = surfaces().filter((s) =>
			s.surfaceId.startsWith("eligibility-question-"),
		);
		expect(questions).toHaveLength(1);
		expect(questions[0].surfaceId).not.toBe(questionId);
		expect(a2uiProcessor.getSurface(questionId)).toBeUndefined();
	});

	it("asks to confirm provisional answers before the result", () => {
		action("start_check", showConsent());
		action("answer", lastSurface().surfaceId, {
			field: "householdComposition",
			value: "SINGLE",
		});
		action("answer", lastSurface().surfaceId, {
			field: "dateOfBirth",
			value: "1980-05-04",
		});
		handleEligibilityAnswer({ field: "livesInGermany", value: "NO" });

		showNextGuidedStep();
		expect(lastSurface().surfaceId).toMatch(/^eligibility-confirm-/);

		action("confirm_provisional", lastSurface().surfaceId);
		expect(lastSurface().surfaceId).toMatch(/^eligibility-result-/);
		expect(useGuidedCheckStore.getState().isActive).toBe(false);
	});
});
