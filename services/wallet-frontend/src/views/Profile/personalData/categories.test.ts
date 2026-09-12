import { describe, it, expect } from "vitest";
import { getCategoryStatuses } from "./categories";
import { getSavedProfileFields, getProfileFormDefaults } from "./formDefaults";
import type { Profile } from "../../../schemas/profile.schema";

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
