import {
	EligibilityCheckSchema,
	type EligibilityCheck,
} from "../schemas/eligibility.schema";
import { EligibilityEngine, type FlowNode } from "./EligibilityEngine";
import { useEligibilityStore } from "./useEligibilityStore";
import { useGuidedCheckStore } from "./useGuidedCheckStore";

export type Field = keyof EligibilityCheck;

export type GuidedStep =
	| { kind: "question"; node: FlowNode & { key: Field } }
	| { kind: "confirm"; fields: Field[] }
	| { kind: "result" };

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
export const nextGuidedStep = (): GuidedStep => {
	const node = currentQuestionNode();
	if (node.type !== "result" && node.key) {
		return { kind: "question", node: { ...node, key: node.key } };
	}
	const fields = provisionalFieldsOnPath();
	if (fields.length > 0) {
		return { kind: "confirm", fields };
	}
	return { kind: "result" };
};

export const startGuidedCheck = () => {
	useEligibilityStore.getState().resetForm();
	useGuidedCheckStore.getState().reset();
	useGuidedCheckStore.getState().start();
};

/** Cards and the model send strings, or a list of birth dates for the children. */
const toSchemaInput = (field: Field, raw: unknown): unknown => {
	if (field === "children" && Array.isArray(raw)) {
		return raw.map((dateOfBirth) => ({ dateOfBirth }));
	}
	if (NUMBER_FIELDS.has(field) && typeof raw === "string") {
		return Number(raw);
	}
	return raw;
};

/** Validates a raw answer from a card or the model against the eligibility schema. */
export const parseAnswer = <K extends Field>(
	field: K,
	raw: unknown,
): EligibilityCheck[K] | undefined => {
	const parsed = EligibilityCheckSchema.shape[field].safeParse(
		toSchemaInput(field, raw),
	);
	return parsed.success ? (parsed.data as EligibilityCheck[K]) : undefined;
};

export const isField = (field: unknown): field is Field =>
	typeof field === "string" && field in EligibilityCheckSchema.shape;

export const answerFromCard = <K extends Field>(
	field: K,
	value: EligibilityCheck[K],
) => {
	useEligibilityStore.getState().setAnswer(field, value);
	useGuidedCheckStore.getState().markFixed(field);
};

/** Stores a value the model took from free text as provisional. Returns whether it fitted the field. */
export const applyProvisionalAnswer = (field: string, value: string) => {
	if (!isField(field) || field === "children") {
		return false;
	}
	const parsed = parseAnswer(field, value);
	if (parsed === undefined) {
		return false;
	}
	useEligibilityStore.getState().setAnswer(field, parsed);
	useGuidedCheckStore.getState().markProvisional(field);
	return true;
};
