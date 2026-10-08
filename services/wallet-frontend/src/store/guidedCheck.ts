import {
	ChatUiComponent,
	ServerUiComponent,
	type ChatUi,
	type ChatUiEvent,
} from "../schemas/chat.schema";
import {
	EligibilityCheckSchema,
	type EligibilityCheck,
} from "../schemas/eligibility.schema";
import { EligibilityEngine, type FlowNode } from "./EligibilityEngine";
import { useEligibilityStore } from "./useEligibilityStore";
import { useGuidedCheckStore } from "./useGuidedCheckStore";

type Field = keyof EligibilityCheck;

const NUMBER_FIELDS: ReadonlySet<Field> = new Set([
	"monthlyGrossIncome",
	"monthlyNetHouseholdIncome",
	"monthlyWarmRent",
]);

export const currentQuestionNode = (): FlowNode => {
	const path = EligibilityEngine.getValidPath(
		useEligibilityStore.getState().answers,
	);
	return EligibilityEngine.getNode(path[path.length - 1]);
};

export const currentGuidedField = (): Field | undefined =>
	useGuidedCheckStore.getState().isActive
		? currentQuestionNode().key
		: undefined;

/** Provisional answers the current path still uses. */
export const provisionalFieldsOnPath = (): Field[] => {
	const onPath = EligibilityEngine.answersOnValidPath(
		useEligibilityStore.getState().answers,
	);
	return useGuidedCheckStore
		.getState()
		.provisionalFields.filter((field) => onPath[field] !== undefined);
};

/** The engine decides what comes next: a question, the confirmation of provisional answers, or the result. */
export const nextGuidedStep = (): ChatUi => {
	const node = currentQuestionNode();
	if (node.type !== "result") {
		return {
			component: ChatUiComponent.ELIGIBILITY_QUESTION,
			props: { nodeId: node.id },
		};
	}
	if (provisionalFieldsOnPath().length > 0) {
		return { component: ChatUiComponent.ELIGIBILITY_CONFIRM, props: {} };
	}
	return { component: ChatUiComponent.ELIGIBILITY_RESULT, props: {} };
};

export const startGuidedCheck = () => {
	useEligibilityStore.getState().resetForm();
	useGuidedCheckStore.getState().reset();
	useGuidedCheckStore.getState().start();
};

export const answerFromCard = <K extends Field>(
	field: K,
	value: EligibilityCheck[K],
) => {
	useEligibilityStore.getState().setAnswer(field, value);
	useGuidedCheckStore.getState().markFixed(field);
};

const applyProvisionalAnswer = (
	props: Record<string, unknown>,
): ChatUi | null => {
	const { field, value } = props;
	if (
		typeof field !== "string" ||
		typeof value !== "string" ||
		!(field in EligibilityCheckSchema.shape) ||
		field === "children"
	) {
		return null;
	}
	const key = field as Field;
	const parsed = EligibilityCheckSchema.shape[key].safeParse(
		NUMBER_FIELDS.has(key) ? Number(value) : value,
	);
	if (!parsed.success) {
		return null;
	}
	useEligibilityStore
		.getState()
		.setAnswer(key, parsed.data as EligibilityCheck[typeof key]);
	useGuidedCheckStore.getState().markProvisional(key);
	return { component: ChatUiComponent.ELIGIBILITY_NOTED, props: { field } };
};

/** Turns a UI event from the backend into a chat card, or null when there is nothing to show. */
export const chatUiFromServer = (event: ChatUiEvent): ChatUi | null => {
	if (event.component === ServerUiComponent.ELIGIBILITY_CONSENT) {
		return { component: ChatUiComponent.ELIGIBILITY_CONSENT, props: {} };
	}
	if (event.component === ServerUiComponent.ELIGIBILITY_ANSWER) {
		return applyProvisionalAnswer(event.props);
	}
	return null;
};
