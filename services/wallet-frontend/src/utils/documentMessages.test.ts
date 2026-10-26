import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import {
	getDocumentFailureMessage,
	getDocumentWarningMessage,
} from "./documentMessages";

const t = ((key: string) => key) as unknown as TFunction;

describe("getDocumentFailureMessage", () => {
	it("translates known failure codes", () => {
		expect(getDocumentFailureMessage(t, "PROCESSING_TIMEOUT")).toBe(
			"errors.codes.PROCESSING_TIMEOUT",
		);
	});

	it("falls back to the generic message for unknown or missing codes", () => {
		expect(getDocumentFailureMessage(t, "SOMETHING_NEW")).toBe(
			"errors.processing_failed",
		);
		expect(getDocumentFailureMessage(t, undefined)).toBe(
			"errors.processing_failed",
		);
	});
});

describe("getDocumentWarningMessage", () => {
	it("translates known warning codes", () => {
		expect(getDocumentWarningMessage(t, "LEGIBILITY_ISSUES")).toBe(
			"review.warnings.LEGIBILITY_ISSUES",
		);
	});

	it("falls back to the default warning for unknown codes", () => {
		expect(getDocumentWarningMessage(t, "SOMETHING_NEW")).toBe(
			"review.warnings.default",
		);
	});
});
