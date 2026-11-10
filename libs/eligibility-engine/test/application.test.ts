import { describe, expect, it } from "vitest";
import type { PersonAnswers } from "../src/index.ts";
import { loadEngine } from "./knowledge.ts";

const engine = loadEngine();
const options = { today: "2026-10-07" };

const applicant: PersonAnswers = {
	firstName: "Sabine",
	lastName: "Beispiel",
	birthDate: "1988-04-12",
	legalGender: "legalGender-female",
	nationality: "DE",
	street: "Musterstraße",
	houseNumber: "12",
	zipCode: "10115",
	city: "Berlin",
	householdComposition: "householdComposition-singleParent",
	maritalStatus: "maritalStatus-divorced",
	childBenefitNumber: "123FK456789",
	iban: "DE89 3704 0044 0532 0130 00",
	accountHolder: "Sabine Beispiel",
};
const child = { birthDate: "2018-03-01", firstName: "Mia", lastName: "Beispiel" };

describe("application progress: Kinderzuschlag", () => {
	it("starts with the first question of the first section", async () => {
		const progress = await engine.progress({ answers: {} }, "applicationKinderzuschlag", options);
		expect(progress.form).toBe("antrag_kinderzuschlag");
		expect(progress.next).toEqual({ field: "firstName", individual: "citizen" });
		expect(progress.complete).toBe(false);
	});

	it("is complete when every field of the form is answered", async () => {
		const progress = await engine.progress({ answers: applicant, children: [child] }, "applicationKinderzuschlag", options);
		expect(progress).toMatchObject({ complete: true, missing: [], invalid: [] });
	});

	it("asks for the children's names after the birth dates the eligibility check collected", async () => {
		const progress = await engine.progress(
			{ answers: applicant, children: [{ birthDate: "2018-03-01" }, { birthDate: "2021-07-07" }] },
			"applicationKinderzuschlag",
			options,
		);
		expect(progress.missing).toEqual([
			{ field: "firstName", individual: "child0" },
			{ field: "lastName", individual: "child0" },
			{ field: "firstName", individual: "child1" },
			{ field: "lastName", individual: "child1" },
		]);
		expect(engine.question("firstName", "de", "child1").question).toBe("Wie ist der Vorname Deines 2. Kindes?");
	});

	it("asks for the partner only for couples, and for the wedding date only when married", async () => {
		const couple = {
			...applicant,
			householdComposition: "householdComposition-coupleWithChildren",
			maritalStatus: "maritalStatus-married",
		};
		const progress = await engine.progress({ answers: couple, children: [child] }, "applicationKinderzuschlag", options);
		expect(progress.missing).toEqual([
			{ field: "firstName", individual: "partner" },
			{ field: "lastName", individual: "partner" },
			{ field: "birthDate", individual: "partner" },
			{ field: "nationality", individual: "partner" },
			{ field: "marriedSince", individual: "citizen" },
		]);
		expect(engine.question("birthDate", "en", "partner").question).toBe("When was your partner born?");
	});

	it("puts malformed answers first, with the rule's message", async () => {
		const progress = await engine.progress(
			{ answers: { ...applicant, zipCode: "1011", iban: "DE12" }, children: [child] },
			"applicationKinderzuschlag",
			{ ...options, lang: "en" },
		);
		expect(progress.invalid).toEqual(
			expect.arrayContaining([
				{ field: "zipCode", individual: "citizen", message: "A postcode has five digits." },
				{ field: "iban", individual: "citizen", message: "This IBAN does not look complete. Please check it again." },
			]),
		);
		expect(progress.next?.field).toMatch(/zipCode|iban/);
		expect(progress.complete).toBe(false);
	});

	it("lists every step of the form, answered or not, for progress and back navigation", async () => {
		const progress = await engine.progress(
			{ answers: applicant, children: [{ birthDate: "2018-03-01" }] },
			"applicationKinderzuschlag",
			options,
		);
		expect(progress.steps).toHaveLength(17);
		expect(progress.answeredCount).toBe(15);
		expect(progress.steps.slice(0, 3)).toEqual([
			{ field: "firstName", individual: "citizen" },
			{ field: "lastName", individual: "citizen" },
			{ field: "birthDate", individual: "citizen" },
		]);
		const childSteps = progress.steps.filter((step) => step.individual === "child0");
		expect(childSteps).toEqual([
			{ field: "firstName", individual: "child0" },
			{ field: "lastName", individual: "child0" },
		]);
	});

	it("describes where each field is stored", () => {
		expect(engine.question("childBenefitNumber").storage).toEqual({ column: "reference_no", incomeType: "Child Benefit" });
		expect(engine.question("maritalStatus").options.find((option) => option.code === "MARRIED")?.storedValue).toBe("Married");
		expect(engine.applications("de")).toEqual([
			{ id: "applicationKinderzuschlag", label: "Antrag auf Kinderzuschlag", form: "antrag_kinderzuschlag", benefit: "kinderzuschlag" },
		]);
	});
});
