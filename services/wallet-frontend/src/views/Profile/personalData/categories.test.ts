import { describe, it, expect } from "vitest";
import { getCategoryStatuses } from "./categories";
import type { Profile } from "../../../schemas/profile.schema";
import {
	answeredIncomeEntries,
	getProfileFormDefaults,
	getSavedProfileFields,
	profileIncomeEntries,
} from "./formDefaults";

describe("getCategoryStatuses", () => {
	it("reports an untouched profile as missing, not partially filled", () => {
		const statuses = getCategoryStatuses(getSavedProfileFields(null));

		expect(statuses.identity).toBe("MISSING");
		expect(statuses.status).toBe("MISSING");
		expect(statuses.address).toBe("MISSING");
	});

	it("does not count the placeholder values the selects fall back to", () => {
		const defaults = getProfileFormDefaults(null);

		expect(defaults.legalGender).toBe("Diverse");
		expect(defaults.maritalStatus).toBe("Single");
		expect(defaults.state).toBe("Berlin");
		expect(getSavedProfileFields(null)).toEqual({});
	});

	it("counts values once they are saved", () => {
		const profile = {
			personalData: { firstName: "Helmut", legalGender: "Male" },
			address: { state: "Berlin" },
		} as unknown as Profile;

		const statuses = getCategoryStatuses(getSavedProfileFields(profile));

		expect(statuses.identity).toBe("PARTIAL");
		expect(statuses.address).toBe("PARTIAL");
	});

	it("reports a category as complete once all its fields are saved", () => {
		const profile = {
			contact: { email: "helmut@example.org", phoneNumber: "+491700000000" },
		} as unknown as Profile;

		expect(getCategoryStatuses(getSavedProfileFields(profile)).contact).toBe(
			"COMPLETE",
		);
	});
});

describe("profile income lines", () => {
	it("shows every line with its stored amount and saves only filled lines", () => {
		const rows = profileIncomeEntries([
			{ incomeType: "Old-Age Pension", monthlyAmount: 650 },
			{ incomeType: "Alimony", monthlyAmount: 120, personSortOrder: 0 },
		]);

		expect(rows).toHaveLength(8);
		expect(rows[0]).toEqual({
			incomeType: "Old-Age Pension",
			monthlyAmount: 650,
		});
		expect(rows.find((r) => r.incomeType === "Alimony")?.monthlyAmount).toBe(
			null,
		);
		expect(answeredIncomeEntries(rows)).toEqual([rows[0]]);
	});
});
