import { describe, expect, it } from "vitest";
import { DEMO_PERSONAS } from "../../../services/wallet-frontend/src/config/demoPersonas.ts";
import type { EligibilityCheck } from "../../../services/wallet-frontend/src/schemas/eligibility.schema.ts";
import { assessBenefits, BenefitStatus } from "../../../services/wallet-frontend/src/store/benefitRules.ts";
import type { Profile, Status } from "../src/index.ts";
import { loadEngine } from "./knowledge.ts";

const TODAY = "2026-10-07";
const engine = loadEngine();

// Wohngeld is left out on purpose: the knowledge base calculates § 19 WoGG, the legacy rules use a rent-share heuristic
const LEGACY_BENEFITS: Record<string, string> = {
	GRUNDSICHERUNGSGELD: "grundsicherungsgeld",
	GRUNDSICHERUNG_ALTER: "grundsicherungImAlter",
	KINDERZUSCHLAG: "kinderzuschlag",
};

const optionId = (field: string, code: string) => {
	const option = engine.question(field).options.find((candidate) => candidate.code === code);
	if (!option) {
		throw new Error(`No option ${code} for ${field}`);
	}
	return option.value;
};

/** Fills the gaps the legacy rules fill silently, so both implementations see the same facts */
const toProfile = (a: Partial<EligibilityCheck>): Profile => {
	const composition = a.householdComposition ?? "SINGLE";
	const withChildren = composition === "SINGLE_PARENT" || composition === "COUPLE_WITH_CHILDREN";
	const nonEu = a.citizenship === "NON_EU";
	return {
		answers: {
			householdComposition: optionId("householdComposition", composition),
			birthDate: a.dateOfBirth ?? TODAY,
			livesInGermany: true,
			isEmployed: a.monthlyGrossIncome !== undefined,
			...(a.monthlyGrossIncome !== undefined && { monthlyGrossIncome: a.monthlyGrossIncome }),
			workCapacity: optionId("workCapacity", a.workCapacity ?? "FULL"),
			monthlyNetHouseholdIncome: a.monthlyNetHouseholdIncome ?? 0,
			monthlyWarmRent: a.monthlyWarmRent ?? 0,
			assetsBand: optionId("assetsBand", a.assetsBand ?? "UNDER_5000"),
			citizenship: optionId("citizenship", a.citizenship ?? "GERMAN"),
			...(nonEu && { hasSecureResidenceStatus: a.hasSecureResidenceStatus === "YES" }),
		},
		children: withChildren ? (a.children ?? []).map((child) => ({ birthDate: child.dateOfBirth })) : [],
	};
};

/**
 * POSSIBLE no longer exists. It becomes eligible, except when the savings band straddles the allowance:
 * then the engine asks for the exact amount instead of guessing.
 */
const expected = (status: string, reason: string): { status: Status; reason?: string } => {
	if (status === BenefitStatus.NO) {
		return { status: "ineligible", reason };
	}
	if (reason === "assets_near_limit") {
		return { status: "missingData" };
	}
	return { status: "eligible" };
};

const compare = async (answers: Partial<EligibilityCheck>) => {
	const result = await engine.match(toProfile(answers), { today: TODAY });
	for (const legacy of assessBenefits(answers, TODAY).filter((a) => a.benefit in LEGACY_BENEFITS)) {
		const actual = result.benefits.find((benefit) => benefit.id === LEGACY_BENEFITS[legacy.benefit]);
		const want = expected(legacy.status, legacy.reason);
		expect({ benefit: legacy.benefit, status: actual?.status, reason: want.reason && actual?.reasons[0]?.key }).toEqual({
			benefit: legacy.benefit,
			...want,
		});
		if (want.status === "missingData") {
			expect(actual?.missing).toEqual(["assetsAmount"]);
		}
	}
};

// Deterministic pseudo-random sample of the answer space
const random = (() => {
	let seed = 42;
	return () => {
		seed = (seed * 1103515245 + 12345) % 2 ** 31;
		return seed / 2 ** 31;
	};
})();
const pick = <T,>(values: readonly T[]): T => values[Math.floor(random() * values.length)];

const sampleAnswers = (): Partial<EligibilityCheck> => {
	const householdComposition = pick(["SINGLE", "SINGLE_PARENT", "COUPLE_NO_CHILDREN", "COUPLE_WITH_CHILDREN"] as const);
	const citizenship = pick(["GERMAN", "EU", "NON_EU"] as const);
	return {
		householdComposition,
		children: pick([[{ dateOfBirth: "2021-03-04" }], [{ dateOfBirth: "2010-10-08" }, { dateOfBirth: "2004-01-30" }], [{ dateOfBirth: "1999-06-15" }]]),
		dateOfBirth: pick(["1945-05-05", "1950-06-15", "1958-10-07", "1960-12-01", "1963-04-30", "1980-01-01", "1995-05-05", "2000-02-02", "2009-01-01"]),
		monthlyGrossIncome: pick([undefined, 0, 599, 600, 899, 900, 2500]),
		workCapacity: pick(["FULL", "TEMPORARILY_REDUCED", "PERMANENTLY_REDUCED"] as const),
		monthlyNetHouseholdIncome: pick([0, 400, 563, 900, 1200, 1800, 3500]),
		monthlyWarmRent: pick([0, 300, 650, 1100]),
		assetsBand: pick(["UNDER_5000", "FROM_5000_TO_10000", "FROM_10000_TO_12500", "FROM_12500_TO_20000", "OVER_20000"] as const),
		receivesBenefits: pick(["YES", "NO"] as const),
		citizenship,
		...(citizenship === "NON_EU" && { hasSecureResidenceStatus: pick(["YES", "NO"] as const) }),
	};
};

describe("parity with benefitRules.ts", () => {
	it.each(DEMO_PERSONAS.map((persona) => [persona.slug, persona.eligibilityAnswers] as const))(
		"persona %s",
		async (_slug, answers) => {
			await compare(answers);
		},
	);

	it("sampled answers", { timeout: 120_000 }, async () => {
		for (let index = 0; index < 400; index++) {
			const answers = sampleAnswers();
			try {
				await compare(answers);
			} catch (error) {
				throw new Error(`${JSON.stringify(answers)}\n${(error as Error).message}`);
			}
		}
	});
});
