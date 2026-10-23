import type { ActionPayload } from "@a2ui/web_core/v0_9";
import { useChatStore } from "../store/useChatStore";
import { useEligibilityStore } from "../store/useEligibilityStore";
import { useGuidedCheckStore } from "../store/useGuidedCheckStore";
import {
	answerFromCard,
	applyProvisionalAnswer,
	isField,
	nextGuidedStep,
	parseAnswer,
	startGuidedCheck,
} from "../store/guidedCheck";
import type { EligibilityAnswerEvent } from "../schemas/chat.schema";
import { A2UI_VERSION, surfaceIdOf, type A2uiMessage } from "./messages";
import {
	answeredQuestion,
	confirmSurface,
	notedSurface,
	questionSurface,
	resultSurface,
	withoutActions,
} from "./guidedCheckSurfaces";
import { setA2uiActionListener } from "./processor";

/**
 * Acts as the agent for the guided eligibility check: the engine in the browser decides the
 * next step and this module turns it into A2UI surfaces and handles their actions.
 */

const apply = (messages: A2uiMessage[]) =>
	useChatStore.getState().applyA2ui(messages);

const stepSurface = (): A2uiMessage[] => {
	const step = nextGuidedStep();
	if (step.kind === "question") {
		return questionSurface(step.node);
	}
	if (step.kind === "confirm") {
		return confirmSurface(step.fields);
	}
	useGuidedCheckStore.getState().finish();
	return resultSurface();
};

/** Shows the next card. A card still waiting for an answer is replaced, so only one is open. */
export const showNextGuidedStep = () => {
	const guided = useGuidedCheckStore.getState();
	const replaced: A2uiMessage[] = guided.openSurfaceId
		? [
				{
					version: A2UI_VERSION,
					deleteSurface: { surfaceId: guided.openSurfaceId },
				},
			]
		: [];
	const surface = stepSurface();
	useGuidedCheckStore
		.getState()
		.setOpenSurface(
			useGuidedCheckStore.getState().isActive ? surfaceIdOf(surface[0]) : null,
		);
	apply([...replaced, ...surface]);
};

const closeCard = (update: A2uiMessage) => {
	useGuidedCheckStore.getState().setOpenSurface(null);
	apply([update]);
};

const handleAnswer = (surfaceId: string, context: Record<string, unknown>) => {
	const { field, value } = context;
	if (!isField(field)) {
		return;
	}
	const parsed = parseAnswer(field, value);
	if (parsed === undefined) {
		return;
	}
	answerFromCard(field, parsed);
	closeCard(answeredQuestion(surfaceId, field, parsed));
	showNextGuidedStep();
};

const settleProvisional = (surfaceId: string, answerOneByOne: boolean) => {
	if (answerOneByOne) {
		useGuidedCheckStore
			.getState()
			.provisionalFields.forEach(useEligibilityStore.getState().clearAnswer);
	}
	useGuidedCheckStore.getState().clearProvisional();
	closeCard(withoutActions(surfaceId));
	showNextGuidedStep();
};

export const handleA2uiAction = (action: ActionPayload) => {
	const { name, surfaceId, context } = action;
	switch (name) {
		case "start_check":
			startGuidedCheck();
			apply([withoutActions(surfaceId)]);
			showNextGuidedStep();
			break;
		case "decline_check":
			apply([withoutActions(surfaceId)]);
			break;
		case "answer":
			handleAnswer(surfaceId, context);
			break;
		case "send_text":
			if (typeof context.text === "string" && context.text.trim()) {
				void useChatStore.getState().sendMessage(context.text);
			}
			break;
		case "confirm_provisional":
			settleProvisional(surfaceId, false);
			break;
		case "answer_one_by_one":
			settleProvisional(surfaceId, true);
			break;
		default:
			break;
	}
};

/** A value the model took from free text: stored as provisional and shown as a note. */
export const handleEligibilityAnswer = ({
	field,
	value,
}: EligibilityAnswerEvent) => {
	if (!applyProvisionalAnswer(field, value) || !isField(field)) {
		return;
	}
	const stored = useEligibilityStore.getState().answers[field];
	if (stored !== undefined) {
		apply(notedSurface(field, stored));
	}
};

setA2uiActionListener(handleA2uiAction);
