import { describe, it, expect } from "vitest";
import { formatDateString, convertGermanToIsoDate } from "./date";

describe("formatDateString Utility", () => {
	it("correctly formats YYYY-MM-DD to DD.MM.YYYY", () => {
		expect(formatDateString("1959-01-20")).toBe("20.01.1959");
	});

	it("correctly formats ISO DateTime with 'T' to DD.MM.YYYY", () => {
		expect(formatDateString("2026-06-10T05:10:33.000Z")).toBe("10.06.2026");
	});

	it("correctly formats ISO DateTime with space to DD.MM.YYYY", () => {
		expect(formatDateString("2026-06-10 05:10:33")).toBe("10.06.2026");
	});

	it("leaves already formatted German date unchanged", () => {
		expect(formatDateString("20.01.1959")).toBe("20.01.1959");
	});

	it("returns invalid calendar dates unchanged", () => {
		expect(formatDateString("2026-99-99")).toBe("2026-99-99");
		expect(formatDateString("2026-02-30")).toBe("2026-02-30"); // Feb 30th
	});

	it("returns other non-date text values as-is", () => {
		expect(formatDateString("not-a-date")).toBe("not-a-date");
		expect(formatDateString("Berlin")).toBe("Berlin");
	});

	it("handles empty or falsy strings safely", () => {
		expect(formatDateString("")).toBe("");
	});

	it("supports formatting for other locales", () => {
		expect(formatDateString("1959-01-20", "en-US")).toBe("01/20/1959");
	});
});

describe("convertGermanToIsoDate Utility", () => {
	it("correctly converts DD.MM.YYYY to YYYY-MM-DD", () => {
		expect(convertGermanToIsoDate("20.01.1959")).toBe("1959-01-20");
	});

	it("returns invalid calendar dates unchanged", () => {
		expect(convertGermanToIsoDate("30.02.2026")).toBe("30.02.2026");
		expect(convertGermanToIsoDate("99.99.2026")).toBe("99.99.2026");
	});

	it("returns non-German formats or normal text unchanged", () => {
		expect(convertGermanToIsoDate("1959-01-20")).toBe("1959-01-20");
		expect(convertGermanToIsoDate("not-a-date")).toBe("not-a-date");
	});

	it("handles empty strings safely", () => {
		expect(convertGermanToIsoDate("")).toBe("");
	});
});
