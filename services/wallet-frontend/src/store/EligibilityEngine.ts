import {
	type EligibilityCheck,
	AssetsBand,
	Binary,
	Citizenship,
	HouseholdComposition,
	ResultProfile,
	WorkCapacity,
} from "../schemas/eligibility.schema";
import { hasReachedRetirementAge } from "./benefitRules";

export type NodeId =
	| "household"
	| "children"
	| "birthdate"
	| "germany"
	| "employment"
	| "gross-income"
	| "work-capacity"
	| "net-income"
	| "warm-rent"
	| "assets"
	| "benefits"
	| "citizenship"
	| "residence-status"
	| "result_eligible"
	| "result_not_eligible";

export interface FlowNode {
	id: NodeId;
	type: "binary" | "multi-choice" | "date" | "number" | "children" | "result";
	key?: keyof EligibilityCheck;
	options?: readonly string[];
	/** Must route an unanswered condition to the longer branch, see getProgress. */
	next?: (answers: Partial<EligibilityCheck>) => NodeId;
	resultProfile?: ResultProfile;
}

const BINARY_OPTIONS = [Binary.YES, Binary.NO] as const;

const afterIncome = (a: Partial<EligibilityCheck>): NodeId =>
	a.dateOfBirth && hasReachedRetirementAge(a.dateOfBirth)
		? "net-income"
		: "work-capacity";

const GRAPH: Record<NodeId, FlowNode> = {
	household: {
		id: "household",
		type: "multi-choice",
		key: "householdComposition",
		options: [
			HouseholdComposition.SINGLE,
			HouseholdComposition.SINGLE_PARENT,
			HouseholdComposition.COUPLE_NO_CHILDREN,
			HouseholdComposition.COUPLE_WITH_CHILDREN,
		],
		next: (a) =>
			a.householdComposition === HouseholdComposition.SINGLE ||
			a.householdComposition === HouseholdComposition.COUPLE_NO_CHILDREN
				? "birthdate"
				: "children",
	},
	children: {
		id: "children",
		type: "children",
		key: "children",
		next: () => "birthdate",
	},
	birthdate: {
		id: "birthdate",
		type: "date",
		key: "dateOfBirth",
		next: () => "germany",
	},
	germany: {
		id: "germany",
		type: "binary",
		key: "livesInGermany",
		options: BINARY_OPTIONS,
		next: (a) =>
			a.livesInGermany === Binary.NO ? "result_not_eligible" : "employment",
	},
	employment: {
		id: "employment",
		type: "binary",
		key: "isEmployed",
		options: BINARY_OPTIONS,
		next: (a) => (a.isEmployed === Binary.NO ? afterIncome(a) : "gross-income"),
	},
	"gross-income": {
		id: "gross-income",
		type: "number",
		key: "monthlyGrossIncome",
		next: afterIncome,
	},
	"work-capacity": {
		id: "work-capacity",
		type: "multi-choice",
		key: "workCapacity",
		options: [
			WorkCapacity.FULL,
			WorkCapacity.TEMPORARILY_REDUCED,
			WorkCapacity.PERMANENTLY_REDUCED,
		],
		next: () => "net-income",
	},
	"net-income": {
		id: "net-income",
		type: "number",
		key: "monthlyNetHouseholdIncome",
		next: () => "warm-rent",
	},
	"warm-rent": {
		id: "warm-rent",
		type: "number",
		key: "monthlyWarmRent",
		next: () => "assets",
	},
	assets: {
		id: "assets",
		type: "multi-choice",
		key: "assetsBand",
		options: [
			AssetsBand.UNDER_5000,
			AssetsBand.FROM_5000_TO_15000,
			AssetsBand.FROM_15000_TO_25000,
			AssetsBand.OVER_25000,
		],
		next: () => "benefits",
	},
	benefits: {
		id: "benefits",
		type: "binary",
		key: "receivesBenefits",
		options: BINARY_OPTIONS,
		next: () => "citizenship",
	},
	citizenship: {
		id: "citizenship",
		type: "multi-choice",
		key: "citizenship",
		options: [Citizenship.DE_EU, Citizenship.NON_EU],
		next: (a) =>
			a.citizenship === Citizenship.DE_EU
				? "result_eligible"
				: "residence-status",
	},
	"residence-status": {
		id: "residence-status",
		type: "binary",
		key: "hasSecureResidenceStatus",
		options: BINARY_OPTIONS,
		next: () => "result_eligible",
	},
	result_eligible: {
		id: "result_eligible",
		type: "result",
		resultProfile: ResultProfile.ELIGIBLE,
	},
	result_not_eligible: {
		id: "result_not_eligible",
		type: "result",
		resultProfile: ResultProfile.NOT_ELIGIBLE,
	},
};

const FIRST_NODE: NodeId = "household";

/** Questions from `from` to the end, following unanswered conditions down their longer branch. */
const countRemainingQuestions = (
	from: NodeId,
	answers: Partial<EligibilityCheck>,
): number => {
	let count = 0;
	let nodeId: NodeId | undefined = from;
	while (nodeId && GRAPH[nodeId].type !== "result") {
		count++;
		nodeId = GRAPH[nodeId].next?.(answers);
	}
	return count;
};

export const EligibilityEngine = {
	getValidPath(answers: Partial<EligibilityCheck>): NodeId[] {
		const path: NodeId[] = [];
		let currentNodeId: NodeId | undefined = FIRST_NODE;

		while (currentNodeId) {
			path.push(currentNodeId);
			const node: FlowNode = GRAPH[currentNodeId];

			if (node.type === "result" || !node.next) {
				break;
			}

			const answer = node.key ? answers[node.key] : undefined;
			currentNodeId = answer !== undefined ? node.next(answers) : undefined;
		}

		return path;
	},

	getNode(id: NodeId): FlowNode {
		return GRAPH[id];
	},

	getOutcomeProfile(path: NodeId[]): ResultProfile | undefined {
		const lastNodeId = path[path.length - 1];
		return GRAPH[lastNodeId].resultProfile;
	},

	/**
	 * Share of the check completed on arriving at `nodeId`, between 0 and 1.
	 *
	 * Each answer covers 1/n of the remaining distance, where n counts the questions still
	 * ahead given only the answers known at that step. A conditional question that shows up
	 * later therefore shrinks the following steps instead of pushing the bar backwards.
	 */
	getProgress(answers: Partial<EligibilityCheck>, nodeId: NodeId): number {
		if (GRAPH[nodeId].type === "result") {
			return 1;
		}
		const path = this.getValidPath(answers);
		const index = path.indexOf(nodeId);
		const known: Partial<EligibilityCheck> = {};
		let progress = 0;

		for (let i = 0; i < index; i++) {
			const key = GRAPH[path[i]].key;
			if (key) {
				Object.assign(known, { [key]: answers[key] });
			}
			const remaining = countRemainingQuestions(path[i], known);
			progress += (1 - progress) / remaining;
		}

		return progress;
	},
};
