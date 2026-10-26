import { describe, expect, it } from "vitest";
import { backendPatch, profileFromBackend, type BackendProfile } from "../src/index.ts";
import { loadEngine } from "./knowledge.ts";

const engine = loadEngine();

const stored: BackendProfile = {
	first_name: "Sabine",
	last_name: "Beispiel",
	date_of_birth: "1988-04-12",
	marital_status: "Married",
	zip_code: null,
	income_entries: [{ income_type: "Child Benefit", person_sort_order: null, reference_no: "123FK456789" }],
	associated_persons: [
		{ association_type: "Parent", lives_in_household: false, first_name: "Erika" },
		{ association_type: "Child", lives_in_household: true, first_name: "Mia", date_of_birth: "2018-03-01" },
		{ association_type: "Spouse", lives_in_household: true, first_name: "Tom", nationality: "DE" },
	],
};

describe("backend profile mapping", () => {
	it("reads answers, partner and children, and derives the household", () => {
		expect(profileFromBackend(engine, stored)).toEqual({
			answers: {
				firstName: "Sabine",
				lastName: "Beispiel",
				birthDate: "1988-04-12",
				maritalStatus: "maritalStatus-married",
				childBenefitNumber: "123FK456789",
				householdComposition: "householdComposition-coupleWithChildren",
			},
			partner: { firstName: "Tom", nationality: "DE" },
			children: [{ firstName: "Mia", birthDate: "2018-03-01" }],
		});
	});

	it("writes answers back without moving existing persons", () => {
		const profile = profileFromBackend(engine, stored);
		profile.answers.zipCode = "10115";
		profile.answers.maritalStatus = "maritalStatus-divorced";
		profile.partner = { ...profile.partner, lastName: "Beispiel" };
		profile.children = [{ ...profile.children![0], lastName: "Beispiel" }, { birthDate: "2021-07-07", firstName: "Ben" }];

		const patch = backendPatch(engine, profile, stored);

		expect(patch).toMatchObject({ zip_code: "10115", marital_status: "Divorced", first_name: "Sabine" });
		expect(patch.income_entries).toEqual([{ income_type: "Child Benefit", person_sort_order: null, reference_no: "123FK456789" }]);
		expect(patch.associated_persons).toEqual([
			{ association_type: "Parent", lives_in_household: false, first_name: "Erika" },
			{ association_type: "Child", lives_in_household: true, first_name: "Mia", date_of_birth: "2018-03-01", last_name: "Beispiel" },
			{ association_type: "Spouse", lives_in_household: true, first_name: "Tom", nationality: "DE", last_name: "Beispiel" },
			{ association_type: "Child", lives_in_household: true, date_of_birth: "2021-07-07", first_name: "Ben" },
		]);
	});

	it("adds a new partner with the type that matches the marital status", () => {
		const patch = backendPatch(
			engine,
			{ answers: { maritalStatus: "maritalStatus-registeredPartnership" }, partner: { firstName: "Alex" } },
			{},
		);
		expect(patch.associated_persons).toEqual([
			{ association_type: "Registered Partner", lives_in_household: true, first_name: "Alex" },
		]);
	});

	it("leaves associated_persons out when nothing about them changed", () => {
		expect(backendPatch(engine, profileFromBackend(engine, stored), stored).associated_persons).toBeUndefined();
	});
});
