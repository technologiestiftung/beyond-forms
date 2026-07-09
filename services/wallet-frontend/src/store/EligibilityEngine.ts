import {
	type EligibilityCheck,
	Binary,
	NationalityStatus,
	PensionStatus,
	IncomeStatus,
	ResultProfile,
} from "../schemas/eligibility.schema";

export type NodeId =
	| "nationality"
	| "germany"
	| "birthdate"
	| "pension"
	| "income"
	| "assets"
	| "result_eligible"
	| "result_not_eligible"
	| "result_sozialamt";

export interface FlowNode {
	id: NodeId;
	type: "binary" | "multi-choice" | "date" | "result";
	key?: keyof EligibilityCheck;
	options?: readonly string[];
	next?: (answers: Partial<EligibilityCheck>) => NodeId;
	resultProfile?: ResultProfile;
}

const GRAPH: Record<NodeId, FlowNode> = {
	nationality: {
		id: "nationality",
		type: "multi-choice",
		key: "nationality",
		options: [
			NationalityStatus.GERMAN,
			NationalityStatus.EU_5_PLUS,
			NationalityStatus.RESIDENCE_PERMIT,
			NationalityStatus.NONE,
		],
		next: (a) => {
			if (a.nationality === NationalityStatus.NONE) {
				return "result_sozialamt";
			}
			return "germany";
		},
	},
	germany: {
		id: "germany",
		type: "binary",
		key: "livesInGermany",
		options: [Binary.YES, Binary.NO],
		next: (a) => {
			if (a.livesInGermany === Binary.NO) {
				return "result_not_eligible";
			}
			return "birthdate";
		},
	},
	birthdate: {
		id: "birthdate",
		type: "date",
		key: "dateOfBirth",
		next: () => "pension",
	},
	pension: {
		id: "pension",
		type: "multi-choice",
		key: "pension",
		options: [
			PensionStatus.OLD_AGE,
			PensionStatus.REDUCED_EARNING_CAPACITY,
			PensionStatus.NONE,
		],
		next: (a) => {
			if (a.pension === PensionStatus.NONE) {
				return "result_not_eligible";
			}
			return "income";
		},
	},
	income: {
		id: "income",
		type: "multi-choice",
		key: "income",
		options: [
			IncomeStatus.NOT_SUFFICIENT,
			IncomeStatus.SOON_INSUFFICIENT,
			IncomeStatus.SUFFICIENT,
		],
		next: (a) => {
			if (a.income === IncomeStatus.SUFFICIENT) {
				return "result_not_eligible";
			}
			return "assets";
		},
	},
	assets: {
		id: "assets",
		type: "binary",
		key: "hasAssetsAboveThreshold",
		options: [Binary.YES, Binary.NO],
		next: (a) => {
			if (a.hasAssetsAboveThreshold === Binary.YES) {
				return "result_not_eligible";
			}
			return "result_eligible";
		},
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
	result_sozialamt: {
		id: "result_sozialamt",
		type: "result",
		resultProfile: ResultProfile.SOZIALAMT,
	},
};

export const EligibilityEngine = {
	getValidPath(answers: Partial<EligibilityCheck>): NodeId[] {
		const path: NodeId[] = [];
		let currentNodeId: NodeId | undefined = "nationality";

		while (currentNodeId) {
			path.push(currentNodeId);
			const node: FlowNode = GRAPH[currentNodeId];

			if (node.type === "result" || !node.next) {
				break;
			}

			const key = node.key;
			const answer = key ? answers[key] : undefined;

			if (answer) {
				currentNodeId = node.next(answers);
			} else {
				currentNodeId = undefined;
			}
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
};
