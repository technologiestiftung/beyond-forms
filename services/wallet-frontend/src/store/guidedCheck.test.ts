import { beforeEach, describe, expect, it } from "vitest";
import { ChatUiComponent, ServerUiComponent } from "../schemas/chat.schema";
import { Binary, HouseholdComposition } from "../schemas/eligibility.schema";
import {
	answerFromCard,
	chatUiFromServer,
	currentGuidedField,
	nextGuidedStep,
	startGuidedCheck,
} from "./guidedCheck";
import { useEligibilityStore } from "./useEligibilityStore";
import { useGuidedCheckStore } from "./useGuidedCheckStore";

describe("guidedCheck", () => {
	beforeEach(() => {
		startGuidedCheck();
	});

	it("starts with the first question of the engine", () => {
		expect(nextGuidedStep()).toEqual({
			component: ChatUiComponent.ELIGIBILITY_QUESTION,
			props: { nodeId: "household" },
		});
		expect(currentGuidedField()).toBe("householdComposition");
	});

	it("moves to the next question after a card answer and keeps it fixed", () => {
		answerFromCard("householdComposition", HouseholdComposition.SINGLE);

		expect(nextGuidedStep().props).toEqual({ nodeId: "birthdate" });
		expect(useGuidedCheckStore.getState().provisionalFields).toEqual([]);
	});

	it("stores a free-text answer as provisional and shows a note", () => {
		const ui = chatUiFromServer({
			component: ServerUiComponent.ELIGIBILITY_ANSWER,
			props: { field: "monthlyWarmRent", value: "650" },
		});

		expect(ui).toEqual({
			component: ChatUiComponent.ELIGIBILITY_NOTED,
			props: { field: "monthlyWarmRent" },
		});
		expect(useEligibilityStore.getState().answers.monthlyWarmRent).toBe(650);
		expect(useGuidedCheckStore.getState().provisionalFields).toEqual([
			"monthlyWarmRent",
		]);
	});

	it("ignores free-text answers that do not fit the field", () => {
		const ui = chatUiFromServer({
			component: ServerUiComponent.ELIGIBILITY_ANSWER,
			props: { field: "livesInGermany", value: "maybe" },
		});

		expect(ui).toBeNull();
		expect(useEligibilityStore.getState().answers.livesInGermany).toBe(
			undefined,
		);
	});

	it("turns a card answer into a fixed one after a provisional answer", () => {
		chatUiFromServer({
			component: ServerUiComponent.ELIGIBILITY_ANSWER,
			props: { field: "livesInGermany", value: "YES" },
		});
		answerFromCard("livesInGermany", Binary.YES);

		expect(useGuidedCheckStore.getState().provisionalFields).toEqual([]);
	});

	it("asks to confirm provisional answers before the result", () => {
		answerFromCard("householdComposition", HouseholdComposition.SINGLE);
		answerFromCard("dateOfBirth", "1990-01-01");
		chatUiFromServer({
			component: ServerUiComponent.ELIGIBILITY_ANSWER,
			props: { field: "livesInGermany", value: "NO" },
		});

		expect(nextGuidedStep().component).toBe(
			ChatUiComponent.ELIGIBILITY_CONFIRM,
		);

		useGuidedCheckStore.getState().clearProvisional();

		expect(nextGuidedStep().component).toBe(ChatUiComponent.ELIGIBILITY_RESULT);
	});

	it("shows the consent card when the backend asks for it", () => {
		expect(
			chatUiFromServer({
				component: ServerUiComponent.ELIGIBILITY_CONSENT,
				props: {},
			}),
		).toEqual({ component: ChatUiComponent.ELIGIBILITY_CONSENT, props: {} });
	});
});
