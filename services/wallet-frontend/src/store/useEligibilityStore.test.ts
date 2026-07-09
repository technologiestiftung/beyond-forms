import { describe, it, expect, beforeEach } from "vitest";
import { useEligibilityStore } from "./useEligibilityStore";
import { Binary, NationalityStatus } from "../schemas/eligibility.schema";

describe("useEligibilityStore (Production Infrastructure)", () => {
	beforeEach(() => {
		useEligibilityStore.getState().resetForm();
		sessionStorage.clear();
	});

	it("should maintain a monotonic progress watermark on next navigation only", () => {
		const { setAnswer, recordStepReached } = useEligibilityStore.getState();

		setAnswer("nationality", NationalityStatus.GERMAN);
		expect(useEligibilityStore.getState().maxDepthReached).toBe(0);

		recordStepReached(2);
		expect(useEligibilityStore.getState().maxDepthReached).toBe(2);

		setAnswer("livesInGermany", Binary.YES);
		expect(useEligibilityStore.getState().maxDepthReached).toBe(2);

		recordStepReached(3);
		expect(useEligibilityStore.getState().maxDepthReached).toBe(3);

		setAnswer("nationality", NationalityStatus.NONE);
		expect(useEligibilityStore.getState().maxDepthReached).toBe(1);
	});

	it("should be non-destructive (retain data on path changes)", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("nationality", NationalityStatus.GERMAN);
		setAnswer("livesInGermany", Binary.YES);

		expect(useEligibilityStore.getState().answers.livesInGermany).toBe(
			Binary.YES,
		);

		setAnswer("nationality", NationalityStatus.NONE);

		expect(useEligibilityStore.getState().answers.livesInGermany).toBe(
			Binary.YES,
		);
	});

	it("should clear an answer and remove it from state", () => {
		const { setAnswer, clearAnswer } = useEligibilityStore.getState();

		setAnswer("dateOfBirth", "1955-01-01");
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBe(
			"1955-01-01",
		);

		clearAnswer("dateOfBirth");
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBeUndefined();
	});

	it("should handle validation errors", () => {
		const { setAnswer } = useEligibilityStore.getState();
		// @ts-expect-error - Intentionally testing runtime validation failure
		setAnswer("nationality", "INVALID_ENUM");

		expect(useEligibilityStore.getState().validationError).toBeDefined();
		expect(useEligibilityStore.getState().answers.nationality).toBeUndefined();
	});

	it("should set validationError for out-of-range date of birth", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("dateOfBirth", "1899-12-31");

		expect(useEligibilityStore.getState().validationError).toBe(
			"Date must be on or after 1 January 1900",
		);
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBeUndefined();
	});

	it("should set validationError for malformed date of birth", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("dateOfBirth", "12.07.2000");

		expect(useEligibilityStore.getState().validationError).toBe(
			"Invalid date format",
		);
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBeUndefined();
	});
});
