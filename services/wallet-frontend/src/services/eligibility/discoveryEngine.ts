import {
	EligibilityEngine,
	type Profile,
} from "@beyond-forms/eligibility-engine";
import type { EligibilityCheck } from "../../schemas/eligibility.schema";

const knowledge = import.meta.glob<string>(
	"../../../../../knowledge/**/*.ttl",
	{
		query: "?raw",
		import: "default",
		eager: true,
	},
);

let engine: EligibilityEngine | undefined;

/** Parsing the knowledge base takes a moment, so the engine is built once on first use */
export const getDiscoveryEngine = (): EligibilityEngine => {
	engine ??= new EligibilityEngine(Object.values(knowledge));
	return engine;
};

const LEGACY_FIELDS: Record<string, keyof EligibilityCheck> = {
	birthDate: "dateOfBirth",
};

/** The answers in the shape of the legacy check, which the profile sync still expects */
export const toEligibilityCheck = ({
	answers,
	children = [],
}: Profile): Partial<EligibilityCheck> => {
	const legacy: Record<string, unknown> = Object.fromEntries(
		Object.entries(answers).map(([field, value]) => {
			const options = getDiscoveryEngine().question(field).options;
			const code = options.find((option) => option.value === value)?.code;
			return [LEGACY_FIELDS[field] ?? field, code ?? value];
		}),
	);
	if (children.length > 0) {
		legacy.children = children.map((child) => ({
			dateOfBirth: String(child.birthDate),
		}));
	}
	return legacy as Partial<EligibilityCheck>;
};
