import { describe, expect, it } from "vitest";
import de from "../../locales/de/eligibility.json";
import en from "../../locales/en/eligibility.json";
import { BINARY_OPTIONS, QUESTION_CATALOGUE } from "./questionCatalogue";

const LOCALES = { de, en } as Record<string, Record<string, unknown>>;

const questionsOf = (locale: string): Record<string, Record<string, unknown>> =>
	LOCALES[locale].questions as Record<string, Record<string, unknown>>;

describe.each(["de", "en"])("question copy (%s)", (locale) => {
	const questions = questionsOf(locale);

	it("has category, title and tip for every question", () => {
		for (const question of QUESTION_CATALOGUE) {
			const block = questions[question.id];
			expect(block, `${question.id} missing`).toBeDefined();
			for (const key of ["category", "title", "tip"]) {
				expect(typeof block[key], `${question.id}.${key}`).toBe("string");
				expect(
					(block[key] as string).length,
					`${question.id}.${key}`,
				).toBeGreaterThan(0);
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

	it("carries no copy for questions that no longer exist", () => {
		const known = new Set(QUESTION_CATALOGUE.map((q) => q.id));
		for (const id of Object.keys(questions)) {
			expect(known.has(id), `stale copy block: ${id}`).toBe(true);
		}
	});
});
