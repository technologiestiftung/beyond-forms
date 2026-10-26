import { describe, expect, it } from "vitest";
import { loadEngine } from "./knowledge.ts";

const engine = loadEngine();
const today = "2026-10-07";
const status = async (answers: Record<string, string | number | boolean>, children?: { birthDate: string }[]) =>
	Object.fromEntries(
		(await engine.match({ answers, children }, { today })).benefits.map((benefit) => [benefit.id, benefit.status]),
	);

const pensioner = {
	householdComposition: "householdComposition-single",
	birthDate: "1955-03-01",
	livesInGermany: true,
	isEmployed: false,
	workCapacity: "workCapacity-full",
	monthlyNetHouseholdIncome: 700,
	monthlyWarmRent: 450,
	assetsBand: "assetsBand-under5000",
	citizenship: "citizenship-german",
	monthlyGrossHouseholdIncome: 900,
	incomeDeductions: "incomeDeductions-health",
	monthlyRentWithoutHeating: 380,
};

describe("EligibilityEngine", () => {
	it("starts with the field most benefits need, ties broken by priority", async () => {
		const result = await engine.match({ answers: {} }, { today });
		expect(result.nextQuestion).toBe("householdComposition");
		expect(result.benefits.every((benefit) => benefit.status === "missingData")).toBe(true);
	});

	it("rules out all benefits when not living in Germany and asks nothing more", async () => {
		const result = await engine.match({ answers: { livesInGermany: false } }, { today });
		expect(result.benefits.map((benefit) => benefit.status)).toEqual(Array(4).fill("ineligible"));
		expect(result.benefits[0].reasons[0].key).toBe("not_living_in_germany");
		expect(result.nextQuestion).toBeUndefined();
		expect(result.missingCount).toBe(0);
	});

	it("does not ask for work capacity once the retirement age is reached", async () => {
		const { workCapacity: _, ...answers } = pensioner;
		const result = await engine.match({ answers }, { today });
		expect(result.missingCount).toBe(0);
		expect(await status(answers)).toEqual({
			grundsicherungsgeld: "ineligible",
			grundsicherungImAlter: "eligible",
			wohngeld: "eligible",
			kinderzuschlag: "ineligible",
		});
	});

	it("asks for the exact savings only when the band straddles the allowance", async () => {
		// A couple aged 45 may keep 2 × 12,500; "more than 20,000" could be either side of that
		const answers = {
			...pensioner,
			householdComposition: "householdComposition-coupleNoChildren",
			birthDate: "1981-01-01",
			monthlyNetHouseholdIncome: 900,
			assetsBand: "assetsBand-over20000",
		};
		const straddling = await engine.match({ answers }, { today });
		expect(straddling.nextQuestion).toBe("assetsAmount");
		expect(await status({ ...answers, assetsAmount: 25_000 })).toMatchObject({ grundsicherungsgeld: "eligible" });
		expect(await status({ ...answers, assetsAmount: 25_001 })).toMatchObject({ grundsicherungsgeld: "ineligible" });
	});

	it("asks for the residence title only for non-EU citizens", async () => {
		const result = await engine.match({ answers: { ...pensioner, citizenship: "citizenship-nonEu" } }, { today });
		expect(result.nextQuestion).toBe("hasSecureResidenceStatus");
	});

	it("needs the children's birth dates for households with children", async () => {
		const answers = { ...pensioner, householdComposition: "householdComposition-singleParent", birthDate: "1990-01-01", monthlyGrossIncome: 1500, isEmployed: true };
		expect((await engine.match({ answers }, { today })).nextQuestion).toBe("hasChild");
		expect(await status(answers, [{ birthDate: "2020-05-05" }])).toMatchObject({ kinderzuschlag: "eligible" });
	});

	it("uses the constant valid on the evaluation date", async () => {
		const answers = { ...pensioner, birthDate: "1990-01-01", assetsBand: "assetsBand-5000to10000" };
		// The age-tiered SGB II allowance only applies from 2026-07-01; before that no value is known
		const before = await engine.match({ answers }, { today: "2026-06-30" });
		expect(before.benefits.find((benefit) => benefit.id === "grundsicherungsgeld")?.status).toBe("missingData");
		expect(await status(answers)).toMatchObject({ grundsicherungsgeld: "eligible" });
	});

	it("describes questions and benefits in the requested language", () => {
		expect(engine.question("isEmployed", "en")).toMatchObject({
			datatype: "boolean",
			question: "Are you currently working?",
			options: [
				{ code: "YES", value: true },
				{ code: "NO", value: false },
			],
		});
		expect(engine.benefits("de").find((benefit) => benefit.id === "wohngeld")).toEqual({
			id: "wohngeld",
			label: "Wohngeld",
			leikaId: "99107023037000",
			legalBasis: "Wohngeldgesetz",
			providingAgency: "Wohngeldstelle",
			applicationForm: "antrag_wohngeld",
		});
	});
});
