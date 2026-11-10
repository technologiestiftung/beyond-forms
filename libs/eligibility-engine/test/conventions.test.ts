import { readFileSync } from "node:fs";
import { DataFactory, Parser, Store } from "n3";
import { describe, expect, it } from "vitest";
import { BF } from "../src/index.ts";
import { knowledgeFiles, loadEngine } from "./knowledge.ts";

const SH = "http://www.w3.org/ns/shacl#";
const RDF_TYPE = DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const { namedNode } = DataFactory;

const store = new Store();
for (const file of knowledgeFiles()) {
	store.addQuads(new Parser().parse(readFileSync(file, "utf8")));
}

const subjectsOfType = (type: string) => store.getSubjects(RDF_TYPE, namedNode(BF + type), null);
const objects = (subject: string, predicate: string) =>
	store.getObjects(namedNode(subject), namedNode(predicate), null);
const languages = (subject: string, predicate: string) =>
	objects(subject, predicate).map((term) => (term.termType === "Literal" ? term.language : ""));

const dataFields = new Set(subjectsOfType("DataField").map((term) => term.value));
const derivedFields = new Set(subjectsOfType("DerivedDataField").map((term) => term.value));
const ruleOutputs = new Set(store.getObjects(null, namedNode(`${BF}output`), null).map((term) => term.value));

describe("knowledge base conventions", () => {
	it("builds an engine", () => {
		expect(() => loadEngine()).not.toThrow();
	});

	it.each([...dataFields])("data field %s has a datatype, a priority and German and English copy", (field) => {
		expect(objects(field, `${BF}datatype`)).toHaveLength(1);
		expect(objects(field, `${BF}questionPriority`)).toHaveLength(1);
		for (const predicate of ["http://www.w3.org/2000/01/rdf-schema#label", "http://schema.org/question"]) {
			expect(languages(field, predicate)).toEqual(expect.arrayContaining(["de", "en"]));
		}
	});

	it.each([...derivedFields])("derived field %s is produced by a rule", (field) => {
		expect(ruleOutputs).toContain(field);
	});

	it("rule inputs are known fields", () => {
		for (const predicate of ["input", "optionalInput"]) {
			for (const input of store.getObjects(null, namedNode(BF + predicate), null)) {
				expect([...dataFields, ...derivedFields]).toContain(input.value);
			}
		}
	});

	it.each(subjectsOfType("RequirementProfile").map((term) => term.value))(
		"requirement profile %s has metadata and well-formed property shapes",
		(profile) => {
			expect(languages(profile, "http://www.w3.org/2000/01/rdf-schema#label")).toEqual(
				expect.arrayContaining(["de", "en"]),
			);
			expect(objects(profile, `${BF}legalBasis`)).toHaveLength(1);
			const [shape] = objects(profile, `${BF}hasMainShape`);
			for (const property of store.getObjects(shape, namedNode(`${SH}property`), null)) {
				const [path] = store.getObjects(property, namedNode(`${SH}path`), null);
				// Without sh:minCount 1 a missing answer would look like a pass instead of a question
				expect(store.getObjects(property, namedNode(`${SH}minCount`), null).map((term) => term.value)).toEqual(["1"]);
				expect([...dataFields, ...derivedFields]).toContain(path.value);
				const decides = store.getObjects(property, namedNode(`${SH}in`), null).length > 0;
				if (decides) {
					expect(store.getObjects(property, namedNode(`${BF}reasonKey`), null)).toHaveLength(1);
					expect(store.getObjects(property, namedNode(`${SH}order`), null)).toHaveLength(1);
				}
			}
		},
	);

	it.each(subjectsOfType("Constant").map((term) => term.value))("constant %s belongs to a keyed series", (constant) => {
		const [series] = objects(constant, `${BF}series`);
		expect(series).toBeDefined();
		expect(store.getObjects(series, namedNode(`${BF}key`), null)).toHaveLength(1);
		expect(objects(constant, `${BF}value`)).toHaveLength(1);
	});
});
