import { describe, expect, it } from "vitest";
import de from "../../locales/de/eligibility.json";
import en from "../../locales/en/eligibility.json";
import { BINARY_OPTIONS, QUESTION_CATALOGUE } from "./questionCatalogue";

const LOCALES = { de, en } as Record<string, Record<string, unknown>>;

const questionsOf = (locale: string): Record<string, Record<string, unknown>> =>
	LOCALES[locale].questions as Record<string, Record<string, unknown>>;

describe.each(["de", "en"])("question copy (%s)", (locale) => {
	const questions = questionsOf(locale);

	it("has a category and a title for every question", () => {
		for (const question of QUESTION_CATALOGUE) {
			const block = questions[question.id];
			expect(block, `${question.id} missing`).toBeDefined();
			expect(typeof block.category, `${question.id}.category`).toBe("string");

			// A question carries either one title or the single/couple pair, never neither.
			const hasPlainTitle = typeof block.title === "string";
			const hasBothVariants =
				typeof block.title_single === "string" &&
				typeof block.title_couple === "string";
			expect(
				hasPlainTitle || hasBothVariants,
				`${question.id} has no usable title`,
			).toBe(true);
		}
	});

	/**
	 * Tips are not mandatory — an info box on every one of thirteen screens stops being
	 * read. Where one exists it must say something, and it must exist in both languages,
	 * which the symmetry test below enforces.
	 */
	it("has no empty tip", () => {
		for (const question of QUESTION_CATALOGUE) {
			const tip = questions[question.id].tip;
			if (tip !== undefined) {
				expect(typeof tip, `${question.id}.tip`).toBe("string");
				expect((tip as string).length, `${question.id}.tip`).toBeGreaterThan(0);
			}
		}
	});

	it("has a label for every option of every choice and boolean question", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input !== "choice" && question.input !== "boolean") {
				continue;
			}
			const options = question.options ?? BINARY_OPTIONS;
			const labels = questions[question.id].options as Record<string, string>;
			expect(labels, `${question.id}.options`).toBeDefined();
			for (const option of options) {
				expect(typeof labels[option], `${question.id}.options.${option}`).toBe(
					"string",
				);
			}
		}
	});

	it("has a unit label for every number question", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input === "number") {
				expect(typeof questions[question.id].unit, `${question.id}.unit`).toBe(
					"string",
				);
			}
		}
	});

	it("has the children list labels", () => {
		const block = questions.children;
		for (const key of ["add", "remove", "child_label"]) {
			expect(typeof block[key], `children.${key}`).toBe("string");
		}
		expect(block.remove as string).toContain("{{index}}");
		expect(block.child_label as string).toContain("{{index}}");
	});

	it("carries the same set of keys in both languages", () => {
		const other = questionsOf(locale === "de" ? "en" : "de");
		for (const question of QUESTION_CATALOGUE) {
			expect(
				Object.keys(questions[question.id]).sort(),
				`${question.id} differs between de and en`,
			).toEqual(Object.keys(other[question.id]).sort());
		}
	});

	it("carries no copy for questions that no longer exist", () => {
		const known = new Set(QUESTION_CATALOGUE.map((q) => q.id));
		for (const id of Object.keys(questions)) {
			expect(known.has(id), `stale copy block: ${id}`).toBe(true);
		}
	});
});
