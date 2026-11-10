/// <reference path="./vendor.d.ts" />
// Ported from FörderFunke's matching engine (MIT), https://github.com/Citizen-Knowledge-Graph/matching-engine
import { QueryEngine } from "@comunica/query-sparql-rdfjs-lite";
import type { Literal, NamedNode, Quad, Term } from "@rdfjs/types";
import { DataFactory, Parser, Store } from "n3";
import rdf from "rdf-ext";
import { Validator, type ValidationResult } from "shacl-engine";
import type {
	AnswerOption,
	AnswerValue,
	ApplicationInfo,
	ApplicationProgress,
	BenefitInfo,
	BenefitResult,
	Datatype,
	MatchOptions,
	FieldRef,
	IndividualId,
	MatchResult,
	Profile,
	Question,
	Reason,
} from "./types.ts";

export const BF = "https://beyond-forms.example/ns#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SH = "http://www.w3.org/ns/shacl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const SCHEMA = "http://schema.org/";
const PROFILE = "urn:beyond-forms:profile:";

const { namedNode, literal, quad } = DataFactory;
const bf = (localName: string) => namedNode(BF + localName);
const rdfType = namedNode(`${RDF}type`);
const MISSING_COMPONENTS = new Set([`${SH}MinCountConstraintComponent`, `${SH}QualifiedMinCountConstraintComponent`]);

export const CITIZEN = `${PROFILE}citizen`;
/** The partner node the rules create for couples, see bf:rulePartner */
export const PARTNER = `${CITIZEN}-partner`;

const individualId = (iri: string): IndividualId => iri.slice(PROFILE.length).replace("citizen-partner", "partner");
const individualIri = (id: IndividualId): string => (id === "partner" ? PARTNER : PROFILE + id);

interface Rule {
	id: string;
	inputs: string[];
	optionalInputs: string[];
	dependsOn: string[];
	outputs: string[];
	query: string;
}

interface RequirementProfile {
	id: string;
	validator: Validator;
}

interface ApplicationProfile {
	id: string;
	form: string;
	validator: Validator;
	/** The fields each shape requires of the individuals of its target class */
	requirements: { targetClass: string; field: string }[];
}

const localName = (iri: string) => iri.slice(BF.length);

const NUMERIC = new Set([`${XSD}integer`, `${XSD}decimal`, `${XSD}double`, `${XSD}float`]);

const toValue = (term: Literal): AnswerValue => {
	if (term.datatype.value === `${XSD}boolean`) {
		return term.value === "true";
	}
	return NUMERIC.has(term.datatype.value) ? Number(term.value) : term.value;
};

export class EligibilityEngine {
	private readonly knowledge: Store;
	private readonly rules: Rule[];
	private readonly ruleByOutput = new Map<string, Rule>();
	private readonly profiles: RequirementProfile[];
	private readonly applicationProfiles: ApplicationProfile[];
	private readonly queryEngine = new QueryEngine();

	constructor(turtles: string[]) {
		this.knowledge = new Store();
		for (const turtle of turtles) {
			this.knowledge.addQuads(new Parser().parse(turtle));
		}
		this.rules = this.sortRules(this.readRules());
		for (const rule of this.rules) {
			for (const output of rule.outputs) {
				this.ruleByOutput.set(output, rule);
			}
		}
		this.profiles = this.subjectsOfType(`${BF}RequirementProfile`).map((id) => {
			const shape = this.object(id, `${BF}hasMainShape`);
			if (!shape) {
				throw new Error(`${id} has no bf:hasMainShape`);
			}
			return { id, validator: new Validator(rdf.dataset(this.describe(shape)), { factory: rdf }) };
		});
		this.applicationProfiles = this.subjectsOfType(`${BF}ApplicationProfile`).map((id) => {
			const shapes = this.objects(id, `${BF}hasShape`).flatMap((shape) => this.describe(shape));
			const form = this.object(id, `${BF}forForm`);
			if (!form || shapes.length === 0) {
				throw new Error(`${id} needs bf:forForm and at least one bf:hasShape`);
			}
			const requirements = this.objects(id, `${BF}hasShape`).flatMap((shape) =>
				this.objects(shape, `${SH}targetClass`).flatMap((targetClass) =>
					this.knowledge
						.getObjects(namedNode(shape), namedNode(`${SH}property`), null)
						.filter((property) => this.knowledge.countQuads(property, namedNode(`${SH}minCount`), null, null) > 0)
						.flatMap((property) => this.knowledge.getObjects(property, namedNode(`${SH}path`), null))
						.map((path) => ({ targetClass, field: path.value })),
				),
			);
			return { id, form, requirements, validator: new Validator(rdf.dataset(shapes), { factory: rdf }) };
		});
	}

	private async materialize(profile: Profile, today: string): Promise<Store> {
		const data = new Store([...this.knowledge.getQuads(null, null, null, null), ...this.profileQuads(profile)]);
		for (const rule of this.rules) {
			const query = rule.query.replaceAll("$TODAY", `"${today}"^^<${XSD}date>`);
			const derived = await (await this.queryEngine.queryQuads(query, { sources: [data] })).toArray();
			data.addQuads(derived);
		}
		return data;
	}

	async match(profile: Profile, { today, lang = "de" }: MatchOptions): Promise<MatchResult> {
		const data = await this.materialize(profile, today);
		const dataset = rdf.dataset(data.getQuads(null, null, null, null));

		const missedBy = new Map<string, Set<string>>();
		const benefits: BenefitResult[] = [];
		for (const { id, validator } of this.profiles) {
			const violations = (await validator.validate({ dataset })).results.filter(
				(result) => result.severity.value === `${SH}Violation`,
			);
			const decisive = violations.filter((result) => !MISSING_COMPONENTS.has(result.constraintComponent.value));
			if (decisive.length > 0) {
				benefits.push({ id: localName(id), status: "ineligible", reasons: this.reasons(decisive, lang), missing: [] });
				continue;
			}
			if (violations.length === 0) {
				benefits.push({ id: localName(id), status: "eligible", reasons: this.eligibleReason(id, lang), missing: [] });
				continue;
			}
			const missing = new Set<string>();
			for (const result of violations) {
				const individual = result.focusNode.term.value;
				for (const field of this.expandMissing(data, individual, result.path[0].predicates[0].value)) {
					missing.add(`${individual}|${field}`);
				}
			}
			for (const key of missing) {
				missedBy.set(key, (missedBy.get(key) ?? new Set()).add(id));
			}
			const fields = [...missing].map((key) => localName(key.split("|")[1]));
			benefits.push({ id: localName(id), status: "missingData", reasons: [], missing: fields });
		}

		return {
			benefits,
			nextQuestion: this.mostMissed(missedBy),
			missingCount: missedBy.size,
			derived: this.derivedFacts(data),
		};
	}

	/** What a form still needs, in the order of its sections */
	async progress(profile: Profile, applicationId: string, { today, lang = "de" }: MatchOptions): Promise<ApplicationProgress> {
		const application = this.applicationProfiles.find(({ id }) => id === BF + applicationId);
		if (!application) {
			throw new Error(`Unknown application ${applicationId}`);
		}
		const data = await this.materialize(profile, today);
		const violations = (await application.validator.validate({ dataset: rdf.dataset(data.getQuads(null, null, null, null)) })).results.filter(
			(result) => result.severity.value === `${SH}Violation`,
		);
		const missing = new Map<string, FieldRef>();
		const invalid: ApplicationProgress["invalid"] = [];
		for (const result of violations) {
			const individual = result.focusNode.term.value;
			const field = result.path[0].predicates[0].value;
			if (MISSING_COMPONENTS.has(result.constraintComponent.value)) {
				for (const needed of this.expandMissing(data, individual, field)) {
					missing.set(`${individual}|${needed}`, { field: localName(needed), individual: individualId(individual) });
				}
			} else {
				const message = (result.message.find((m) => m.language === lang) ?? result.message[0])?.value;
				invalid.push({ field: localName(field), individual: individualId(individual), message });
			}
		}
		const ordered = [...missing.values()].sort((a, b) => this.compareInForm(a, b));
		const steps = new Map(ordered.map((ref) => [`${ref.individual}|${ref.field}`, ref]));
		for (const { targetClass, field } of application.requirements) {
			for (const individual of data.getSubjects(rdfType, namedNode(targetClass), null)) {
				const ref = { field: localName(field), individual: individualId(individual.value) };
				steps.set(`${ref.individual}|${ref.field}`, ref);
			}
		}
		const allSteps = [...steps.values()].sort((a, b) => this.compareInForm(a, b));
		return {
			id: applicationId,
			form: application.form,
			complete: ordered.length === 0 && invalid.length === 0,
			missing: ordered,
			invalid,
			next: invalid[0] ?? ordered[0],
			steps: allSteps,
			answeredCount: allSteps.length - ordered.length,
			derived: this.derivedFacts(data),
		};
	}

	applications(lang = "de"): ApplicationInfo[] {
		return this.applicationProfiles.map(({ id, form }) => ({
			id: localName(id),
			label: this.text(id, `${RDFS}label`, lang) ?? localName(id),
			form,
			benefit: this.object(id, `${BF}forBenefit`)?.slice(BF.length),
		}));
	}

	/** Section order first, then applicant, partner, children, then the field's priority */
	private compareInForm(a: FieldRef, b: FieldRef): number {
		const sectionOrder = (field: string) => {
			const section = this.object(BF + field, `${BF}section`);
			return Number((section && this.object(section, `${SH}order`)) ?? Number.MAX_SAFE_INTEGER);
		};
		const individualOrder = (id: IndividualId) => (id === "citizen" ? -2 : id === "partner" ? -1 : Number(id.slice(5)));
		const priority = (field: string) => Number(this.object(BF + field, `${BF}questionPriority`) ?? Number.MAX_SAFE_INTEGER);
		return (
			sectionOrder(a.field) - sectionOrder(b.field) ||
			individualOrder(a.individual) - individualOrder(b.individual) ||
			priority(a.field) - priority(b.field)
		);
	}

	question(id: string, lang = "de", individual: IndividualId = "citizen"): Question {
		const iri = BF + id;
		if (!this.knowledge.has(quad(namedNode(iri), rdfType, bf("DataField")))) {
			throw new Error(`Unknown data field ${id}`);
		}
		const datatype = this.object(iri, `${BF}datatype`);
		const optionList = this.knowledge.getObjects(namedNode(iri), bf("answerOptions"), null)[0];
		const options: AnswerOption[] = optionList
			? this.list(optionList).map((option) => ({
					id: localName(option),
					code: this.object(option, `${BF}code`),
					label: this.text(option, `${RDFS}label`, lang) ?? localName(option),
					value: this.literalValue(option, `${BF}value`) ?? localName(option),
					storedValue: this.object(option, `${BF}storedValue`),
				}))
			: [];
		const variant =
			individual === "partner"
				? this.text(iri, `${BF}partnerQuestion`, lang)
				: individual.startsWith("child")
					? this.text(iri, `${BF}childQuestion`, lang)?.replace("{{number}}", String(Number(individual.slice(5)) + 1))
					: undefined;
		const column = this.object(iri, `${BF}storedAs`);
		const section = this.object(iri, `${BF}section`);
		return {
			id,
			datatype: localName(datatype ?? `${BF}selection`) as Datatype,
			category: (section && this.text(section, `${RDFS}label`, lang)) ?? this.text(iri, `${RDFS}label`, lang) ?? id,
			question: variant ?? this.text(iri, `${SCHEMA}question`, lang) ?? id,
			tip: this.text(iri, `${RDFS}comment`, lang),
			options,
			storage: column ? { column, incomeType: this.object(iri, `${BF}incomeType`) } : undefined,
			section: section && localName(section),
		};
	}

	/** All answerable data fields, for mapping a stored profile to answers */
	dataFields(): string[] {
		return this.subjectsOfType(`${BF}DataField`).map(localName);
	}

	benefits(lang = "de"): BenefitInfo[] {
		return this.profiles.map(({ id }) => {
			const legalBasis = this.object(id, `${BF}legalBasis`);
			const agency = this.object(id, `${BF}providingAgency`);
			return {
				id: localName(id),
				label: this.text(id, `${RDFS}label`, lang) ?? localName(id),
				leikaId: this.object(id, `${BF}leikaId`),
				legalBasis: legalBasis && this.text(legalBasis, `${RDFS}label`, lang),
				providingAgency: agency && this.text(agency, `${RDFS}label`, lang),
				applicationForm: this.object(id, `${BF}hasApplicationForm`),
			};
		});
	}

	private profileQuads({ answers, partner, children = [] }: Profile): Quad[] {
		const citizen = namedNode(CITIZEN);
		const quads = [quad(citizen, rdfType, bf("Citizen")), ...this.answerQuads(citizen, answers)];
		if (partner) {
			quads.push(...this.answerQuads(namedNode(individualIri("partner")), partner));
		}
		children.forEach((childAnswers, index) => {
			const child = namedNode(`${PROFILE}child${index}`);
			quads.push(quad(citizen, bf("hasChild"), child), quad(child, rdfType, bf("Child")));
			quads.push(...this.answerQuads(child, childAnswers));
		});
		return quads;
	}

	private answerQuads(subject: NamedNode, answers: Record<string, AnswerValue>): Quad[] {
		return Object.entries(answers).map(([field, value]) => {
			const datatype = this.object(BF + field, `${BF}datatype`);
			return quad(subject, bf(field), this.answerTerm(field, datatype, value));
		});
	}

	private answerTerm(field: string, datatype: string | undefined, value: AnswerValue): NamedNode | Literal {
		switch (datatype) {
			case `${BF}selection`:
				return bf(String(value));
			case `${BF}boolean`:
				return literal(String(value), namedNode(`${XSD}boolean`));
			case `${BF}date`:
				return literal(String(value), namedNode(`${XSD}date`));
			case `${BF}text`:
			case `${BF}country`:
				return literal(String(value));
			case `${BF}euroAmount`:
				return literal(String(value), namedNode(Number.isInteger(value) ? `${XSD}integer` : `${XSD}decimal`));
			default:
				throw new Error(`Data field ${field} cannot be answered directly`);
		}
	}

	private derivedFacts(data: Store): Record<string, AnswerValue> {
		const facts: Record<string, AnswerValue> = {};
		for (const triple of data.getQuads(namedNode(CITIZEN), null, null, null)) {
			const isDerived = this.knowledge.has(quad(namedNode(triple.predicate.value), rdfType, bf("DerivedDataField")));
			if (isDerived && triple.object.termType === "Literal") {
				facts[localName(triple.predicate.value)] = toValue(triple.object);
			}
		}
		return facts;
	}

	/** Turns a missing field into the answerable fields still needed to derive it */
	private expandMissing(data: Store, individual: string, field: string): string[] {
		if (data.countQuads(namedNode(individual), namedNode(field), null, null) > 0) {
			return [];
		}
		const rule = this.ruleByOutput.get(field);
		if (!rule) {
			return [field];
		}
		const required = rule.inputs.flatMap((input) => this.expandMissing(data, individual, input));
		return required.length > 0
			? required
			: rule.optionalInputs.flatMap((input) => this.expandMissing(data, individual, input));
	}

	/** Most missed first; ties go to the lower bf:questionPriority, then alphabetically */
	private mostMissed(missedBy: Map<string, Set<string>>): string | undefined {
		const ranked = [...missedBy.entries()]
			.filter(([key]) => key.startsWith(`${CITIZEN}|`))
			.map(([key, profiles]) => {
				const field = key.split("|")[1];
				const priority = Number(this.object(field, `${BF}questionPriority`) ?? Number.MAX_SAFE_INTEGER);
				return { field, count: profiles.size, priority };
			})
			.sort((a, b) => b.count - a.count || a.priority - b.priority || a.field.localeCompare(b.field));
		return ranked[0] && localName(ranked[0].field);
	}

	private reasons(results: ValidationResult[], lang: string): Reason[] {
		const order = (result: ValidationResult) =>
			Number(result.shape.ptr.out([namedNode(`${SH}order`)]).terms[0]?.value ?? Number.MAX_SAFE_INTEGER);
		return [...results]
			.sort((a, b) => order(a) - order(b))
			.map((result) => ({
				key: result.shape.ptr.out([bf("reasonKey")]).terms[0]?.value,
				message: (result.message.find((message) => message.language === lang) ?? result.message[0])?.value,
			}));
	}

	private eligibleReason(id: string, lang: string): Reason[] {
		const key = this.object(id, `${BF}eligibleReasonKey`);
		const message = this.text(id, `${BF}eligibleReason`, lang);
		return key || message ? [{ key, message }] : [];
	}

	private readRules(): Rule[] {
		return this.subjectsOfType(`${BF}MaterializationRule`).map((id) => {
			const query = this.object(id, `${BF}sparqlConstruct`);
			if (!query) {
				throw new Error(`${id} has no bf:sparqlConstruct`);
			}
			return {
				id,
				inputs: this.objects(id, `${BF}input`),
				optionalInputs: this.objects(id, `${BF}optionalInput`),
				dependsOn: this.objects(id, `${BF}dependsOn`),
				outputs: this.objects(id, `${BF}output`),
				query,
			};
		});
	}

	private sortRules(rules: Rule[]): Rule[] {
		const producers = new Map(rules.flatMap((rule) => rule.outputs.map((output) => [output, rule] as const)));
		const sorted: Rule[] = [];
		const visiting = new Set<Rule>();
		const visit = (rule: Rule) => {
			if (sorted.includes(rule)) {
				return;
			}
			if (visiting.has(rule)) {
				throw new Error(`Materialization rules form a cycle at ${rule.id}`);
			}
			visiting.add(rule);
			for (const input of [...rule.inputs, ...rule.optionalInputs, ...rule.dependsOn]) {
				const producer = producers.get(input);
				if (producer) {
					visit(producer);
				}
			}
			visiting.delete(rule);
			sorted.push(rule);
		};
		rules.forEach(visit);
		return sorted;
	}

	/** The node's triples plus everything reachable through blank nodes, e.g. property shapes and lists */
	private describe(node: string | Term): Quad[] {
		const subject = typeof node === "string" ? namedNode(node) : node;
		return this.knowledge.getQuads(subject, null, null, null).flatMap((triple) =>
			triple.object.termType === "BlankNode" ? [triple, ...this.describe(triple.object)] : [triple],
		);
	}

	private subjectsOfType(type: string): string[] {
		return this.knowledge.getSubjects(rdfType, namedNode(type), null).map((subject) => subject.value);
	}

	private objects(subject: string, predicate: string): string[] {
		return this.knowledge.getObjects(namedNode(subject), namedNode(predicate), null).map((object) => object.value);
	}

	private object(subject: string, predicate: string): string | undefined {
		return this.objects(subject, predicate)[0];
	}

	private text(subject: string, predicate: string, lang: string): string | undefined {
		const texts = this.knowledge.getObjects(namedNode(subject), namedNode(predicate), null);
		const match = texts.find((text) => text.termType === "Literal" && text.language === lang) ?? texts[0];
		return match?.value;
	}

	private literalValue(subject: string, predicate: string): AnswerValue | undefined {
		const term = this.knowledge.getObjects(namedNode(subject), namedNode(predicate), null)[0];
		return term?.termType === "Literal" ? toValue(term) : undefined;
	}

	private list(head: Term): string[] {
		const items: string[] = [];
		let node = head;
		while (node.value !== `${RDF}nil`) {
			const first = this.knowledge.getObjects(node, namedNode(`${RDF}first`), null)[0];
			const rest = this.knowledge.getObjects(node, namedNode(`${RDF}rest`), null)[0];
			if (!first || !rest) {
				break;
			}
			items.push(first.value);
			node = rest;
		}
		return items;
	}
}
