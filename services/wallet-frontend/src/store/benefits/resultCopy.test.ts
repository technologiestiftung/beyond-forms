import { describe, expect, it } from "vitest";
import de from "../../locales/de/eligibility.json";
import en from "../../locales/en/eligibility.json";
import {
	BenefitId,
	BenefitStatus,
	HintCode,
	ReasonCode,
} from "../../schemas/benefitCheck.schema";

const LOCALES = { de, en } as Record<string, Record<string, unknown>>;

const resultOf = (locale: string): Record<string, Record<string, string>> =>
	LOCALES[locale].result as Record<string, Record<string, string>>;

describe.each(["de", "en"])("result copy (%s)", (locale) => {
	const result = resultOf(locale);

	it("has the frame texts", () => {
		for (const key of ["title", "cta", "disclaimer"]) {
			expect(typeof result[key], key).toBe("string");
			expect((result[key] as unknown as string).length, key).toBeGreaterThan(0);
		}
		for (const key of ["title", "description", "link"]) {
			expect(typeof result.referral[key], `referral.${key}`).toBe("string");
		}
	});

	it("names every benefit", () => {
		for (const id of Object.values(BenefitId)) {
			expect(typeof result.benefit[id], `benefit.${id}`).toBe("string");
		}
	});

	it("labels every status", () => {
		for (const status of Object.values(BenefitStatus)) {
			expect(typeof result.status[status], `status.${status}`).toBe("string");
		}
	});

	it("explains every reason code", () => {
		for (const code of Object.values(ReasonCode)) {
			expect(typeof result.reason[code], `reason.${code}`).toBe("string");
		}
	});

	it("explains every hint code", () => {
		for (const code of Object.values(HintCode)) {
			expect(typeof result.hint[code], `hint.${code}`).toBe("string");
		}
	});

	it("carries no copy for codes that no longer exist", () => {
		const known = {
			benefit: new Set<string>(Object.values(BenefitId)),
			status: new Set<string>(Object.values(BenefitStatus)),
			reason: new Set<string>(Object.values(ReasonCode)),
			hint: new Set<string>(Object.values(HintCode)),
		};
		for (const [group, allowed] of Object.entries(known)) {
			for (const key of Object.keys(result[group])) {
				expect(allowed.has(key), `stale ${group}.${key}`).toBe(true);
			}
		}
	});
});
