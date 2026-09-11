import { describe, it, expect } from "vitest";
import {
	formatDateString,
	convertGermanToIsoDate,
	parseLocalizedDate,
	formatIsoForInput,
	maskDateInput,
} from "./date";

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

describe("parseLocalizedDate", () => {
	it("reads the German order day-first", () => {
		expect(parseLocalizedDate("11.09.2026", "de")).toBe("2026-09-11");
	});

	it("reads the English order month-first", () => {
		expect(parseLocalizedDate("09/11/2026", "en-US")).toBe("2026-09-11");
	});

	it("reads the same digits differently per locale", () => {
		expect(parseLocalizedDate("01.02.2026", "de")).toBe("2026-02-01");
		expect(parseLocalizedDate("01/02/2026", "en-US")).toBe("2026-01-02");
	});

	it("rejects a date that does not exist", () => {
		expect(parseLocalizedDate("30.02.2026", "de")).toBe("");
	});

	it("rejects an incomplete date", () => {
		expect(parseLocalizedDate("11.09.20", "de")).toBe("");
		expect(parseLocalizedDate("", "de")).toBe("");
	});

	it("ignores which separator was typed", () => {
		expect(parseLocalizedDate("11-09-2026", "de")).toBe("2026-09-11");
	});
});

describe("formatIsoForInput", () => {
	it("writes German dates day-first with dots", () => {
		expect(formatIsoForInput("2026-09-11", "de")).toBe("11.09.2026");
	});

	it("writes English dates month-first with slashes", () => {
		expect(formatIsoForInput("2026-09-11", "en-US")).toBe("09/11/2026");
	});

	it("round-trips through parseLocalizedDate", () => {
		for (const locale of ["de", "en-US"]) {
			expect(
				parseLocalizedDate(formatIsoForInput("1959-01-20", locale), locale),
			).toBe("1959-01-20");
		}
	});

	it("leaves an empty value empty", () => {
		expect(formatIsoForInput("", "de")).toBe("");
	});
});

describe("maskDateInput", () => {
	it("inserts separators as the digits arrive", () => {
		expect(maskDateInput("1", "de")).toBe("1");
		expect(maskDateInput("11", "de")).toBe("11");
		expect(maskDateInput("119", "de")).toBe("11.9");
		expect(maskDateInput("11092026", "de")).toBe("11.09.2026");
	});

	it("uses slashes in English", () => {
		expect(maskDateInput("09112026", "en-US")).toBe("09/11/2026");
	});

	it("stops at eight digits", () => {
		expect(maskDateInput("110920261234", "de")).toBe("11.09.2026");
	});

	it("survives deleting back through a separator", () => {
		expect(maskDateInput("11.0", "de")).toBe("11.0");
		expect(maskDateInput("11.", "de")).toBe("11");
	});
});

describe("parseLocalizedDate: years below 100", () => {
	it("keeps a mistyped year 0001 as year 1, not 1901", () => {
		// The range check downstream must be able to say "too early"; silently promoting it
		// to 1901 would hide the mistake.
		expect(parseLocalizedDate("11.02.0001", "de")).toBe("0001-02-11");
	});

	it("still rejects 29 February in a common year", () => {
		expect(parseLocalizedDate("29.02.2026", "de")).toBe("");
		expect(parseLocalizedDate("29.02.2024", "de")).toBe("2024-02-29");
	});

	it("applies the century rule to leap years", () => {
		expect(parseLocalizedDate("29.02.1900", "de")).toBe("");
		expect(parseLocalizedDate("29.02.2000", "de")).toBe("2000-02-29");
	});
});
