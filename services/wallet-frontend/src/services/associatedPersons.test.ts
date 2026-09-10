import { describe, expect, it } from "vitest";
import { mergeChildren } from "./associatedPersons";
import type { AssociatedPersonRow } from "./associatedPersons";

const spouse: AssociatedPersonRow = {
	association_type: "Spouse",
	lives_in_household: true,
	sort_order: 0,
	first_name: "Ingrid",
	date_of_birth: "1957-08-14",
};

const child = (
	dateOfBirth: string,
	firstName?: string,
): AssociatedPersonRow => ({
	association_type: "Child",
	lives_in_household: true,
	sort_order: 0,
	date_of_birth: dateOfBirth,
	...(firstName ? { first_name: firstName } : {}),
});

describe("mergeChildren", () => {
	it("creates rows when the collection is empty", () => {
		const merged = mergeChildren([], [{ dateOfBirth: "2020-02-11" }]);
		expect(merged).toEqual([
			{
				association_type: "Child",
				lives_in_household: true,
				sort_order: 0,
				date_of_birth: "2020-02-11",
			},
		]);
	});

	it("leaves a spouse untouched and appends the child after them", () => {
		const merged = mergeChildren([spouse], [{ dateOfBirth: "2020-02-11" }]);
		expect(merged).toHaveLength(2);
		expect(merged[0].first_name).toBe("Ingrid");
		expect(merged[0].association_type).toBe("Spouse");
		expect(merged[1].association_type).toBe("Child");
	});

	it("keeps an existing child's name when the date of birth matches", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia")],
			[{ dateOfBirth: "2020-02-11" }],
		);
		expect(merged).toHaveLength(1);
		expect(merged[0].first_name).toBe("Mia");
	});

	it("drops a child the applicant no longer names", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia"), child("2015-03-01", "Jonas")],
			[{ dateOfBirth: "2020-02-11" }],
		);
		expect(merged).toHaveLength(1);
		expect(merged[0].first_name).toBe("Mia");
	});

	it("keeps non-child rows even when every child is dropped", () => {
		const merged = mergeChildren([spouse, child("2015-03-01")], []);
		expect(merged).toHaveLength(1);
		expect(merged[0].association_type).toBe("Spouse");
	});

	it("preserves the order of the rows it keeps", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia"), spouse],
			[{ dateOfBirth: "2020-02-11" }, { dateOfBirth: "2023-07-01" }],
		);
		expect(merged.map((row) => row.association_type)).toEqual([
			"Child",
			"Spouse",
			"Child",
		]);
		expect(merged[0].first_name).toBe("Mia");
		expect(merged[2].date_of_birth).toBe("2023-07-01");
	});

	it("renumbers sort_order without gaps", () => {
		const merged = mergeChildren(
			[spouse],
			[{ dateOfBirth: "2020-02-11" }, { dateOfBirth: "2023-07-01" }],
		);
		expect(merged.map((row) => row.sort_order)).toEqual([0, 1, 2]);
	});

	it("matches two children with the same date of birth to two rows", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia"), child("2020-02-11", "Tom")],
			[{ dateOfBirth: "2020-02-11" }, { dateOfBirth: "2020-02-11" }],
		);
		expect(merged).toHaveLength(2);
		expect(merged.map((row) => row.first_name)).toEqual(["Mia", "Tom"]);
	});
});
