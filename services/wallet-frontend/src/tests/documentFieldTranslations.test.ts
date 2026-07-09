import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import deProfile from "../locales/de/profile.json";
import enProfile from "../locales/en/profile.json";

const currentDir = dirname(fileURLToPath(import.meta.url));
const documentTypesPath = join(
	currentDir,
	"../../../../libs/document-schemas/src/beyondforms/document_schemas/document_types.py",
);

function extractSchemaFieldNames(source: string): Set<string> {
	const fields = new Set<string>();
	const fieldPattern = /^\s{4}(\w+):\s+Optional\[/gm;
	for (const match of source.matchAll(fieldPattern)) {
		fields.add(match[1]);
	}
	return fields;
}

describe("document field translations", () => {
	const schemaFields = extractSchemaFieldNames(
		readFileSync(documentTypesPath, "utf8"),
	);
	const deFields = new Set(Object.keys(deProfile.review.fields));
	const enFields = new Set(Object.keys(enProfile.review.fields));

	it("includes every DIS schema field in German review.fields", () => {
		const missing = [...schemaFields].filter((field) => !deFields.has(field));
		expect(missing).toEqual([]);
	});

	it("includes every DIS schema field in English review.fields", () => {
		const missing = [...schemaFields].filter((field) => !enFields.has(field));
		expect(missing).toEqual([]);
	});
});
