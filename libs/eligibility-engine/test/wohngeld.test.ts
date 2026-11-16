import { describe, expect, it } from "vitest";
import { loadEngine } from "./knowledge.ts";

const engine = loadEngine();
const today = "2026-10-07";

// Independent re-implementation of § 19 WoGG for Mietenstufe IV, values typed in from the statute
const MAX_RENT = [511, 619, 737, 858, 982];
const MAX_RENT_EXTRA = 119;
const CLIMATE = [19.2, 24.8, 29.6, 34.4, 39.2];
const CLIMATE_EXTRA = 4.8;
const HEATING = [110.4, 142.6, 170.2, 197.8, 225.4];
const HEATING_EXTRA = 27.6;
const A = [0.04, 0.03, 0.02, 0.01, 0, -0.01, -0.02, -0.03, -0.04, -0.06, -0.09, -0.12];
const B = [4.797e-4, 3.571e-4, 2.917e-4, 2.163e-4, 1.907e-4, 1.722e-4, 1.592e-4, 1.583e-4, 1.376e-4, 1.249e-4, 1.141e-4, 1.107e-4];
const C = [4.08e-5, 3.04e-5, 2.45e-5, 1.76e-5, 1.72e-5, 1.66e-5, 1.65e-5, 1.65e-5, 1.66e-5, 1.66e-5, 1.96e-5, 2.21e-5];
const MIN_M = [54, 67, 79, 92, 103, 103, 115, 128, 140, 152, 187, 298];
const MIN_Y = [396, 679, 906, 1132, 1358, 1585, 1811, 2037, 2264, 2490, 2717, 2943];

const reference = (size: number, rent: number, gross: number, share: number, yearlyAllowance: number) => {
	const row = Math.min(size, 5) - 1;
	const extra = Math.max(size - 5, 0);
	const ceiling = MAX_RENT[row] + extra * MAX_RENT_EXTRA + CLIMATE[row] + extra * CLIMATE_EXTRA;
	const rawM = Math.min(rent, ceiling) + HEATING[row] + extra * HEATING_EXTRA;
	const rawY = Math.max(gross * 12 * (1 - share) - yearlyAllowance, 0) / 12;
	const r = Math.min(size, 12) - 1;
	const m = Math.max(rawM, MIN_M[r]);
	const y = Math.max(rawY, MIN_Y[r]);
	return Math.floor(1.15 * (m - (A[r] + B[r] * m + C[r] * y) * y) + 0.5);
};

const DEDUCTIONS = {
	"incomeDeductions-taxHealthPension": 0.3,
	"incomeDeductions-health": 0.1,
	"incomeDeductions-none": 0,
} as const;

const HOUSEHOLDS = [
	{ composition: "householdComposition-single", children: [], size: 1, allowance: 0 },
	{ composition: "householdComposition-coupleNoChildren", children: [], size: 2, allowance: 0 },
	{ composition: "householdComposition-singleParent", children: ["2016-04-01"], size: 2, allowance: 1320 },
	{ composition: "householdComposition-coupleWithChildren", children: ["2012-01-01", "2015-01-01", "2020-01-01"], size: 5, allowance: 0 },
	{ composition: "householdComposition-coupleWithChildren", children: ["2008-01-01", "2010-01-01", "2012-01-01", "2014-01-01", "2016-01-01"], size: 7, allowance: 0 },
];

const wohngeld = async (household: (typeof HOUSEHOLDS)[number], rent: number, gross: number, deductions: string) => {
	const result = await engine.match(
		{
			answers: {
				householdComposition: household.composition,
				livesInGermany: true,
				citizenship: "citizenship-german",
				monthlyRentWithoutHeating: rent,
				monthlyGrossHouseholdIncome: gross,
				incomeDeductions: deductions,
			},
			children: household.children.map((birthDate) => ({ birthDate })),
		},
		{ today },
	);
	return {
		amount: result.derived.wohngeldAmount,
		status: result.benefits.find((benefit) => benefit.id === "wohngeld")?.status,
	};
};

describe("Wohngeld, § 19 WoGG", () => {
	it("matches a calculation by hand", async () => {
		// Single person, 500 € rent without heating, 1,500 € gross with all three deductions:
		// M = 500 + 110.40 = 610.40, Y = 1,050; 1.15 · (610.40 − (0.04 + 0.0004797·610.40 + 0.0000408·1,050) · 1,050) = 248.36
		expect(await wohngeld(HOUSEHOLDS[0], 500, 1500, "incomeDeductions-taxHealthPension")).toEqual({
			amount: 248,
			status: "eligible",
		});
	});

	it("caps the rent at the Höchstbetrag plus Klimakomponente", async () => {
		const capped = await wohngeld(HOUSEHOLDS[0], 2000, 1500, "incomeDeductions-taxHealthPension");
		const atCeiling = await wohngeld(HOUSEHOLDS[0], 511 + 19.2, 1500, "incomeDeductions-taxHealthPension");
		expect(capped.amount).toBe(atCeiling.amount);
	});

	it("pays nothing below 10 €", async () => {
		const result = await wohngeld(HOUSEHOLDS[0], 300, 3500, "incomeDeductions-taxHealthPension");
		expect(result.status).toBe("ineligible");
		expect(Number(result.amount)).toBeLessThan(10);
	});

	it("agrees with the reference implementation", { timeout: 120_000 }, async () => {
		for (const household of HOUSEHOLDS) {
			for (const rent of [150, 450, 700, 1200]) {
				for (const gross of [0, 600, 1200, 2000, 3500]) {
					for (const [deductions, share] of Object.entries(DEDUCTIONS)) {
						const want = reference(household.size, rent, gross, share, household.allowance);
						const got = await wohngeld(household, rent, gross, deductions);
						expect({ household: household.composition, size: household.size, rent, gross, deductions, ...got }).toEqual({
							household: household.composition,
							size: household.size,
							rent,
							gross,
							deductions,
							amount: want,
							status: want >= 10 ? "eligible" : "ineligible",
						});
					}
				}
			}
		}
	});
});
