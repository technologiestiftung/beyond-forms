import type { EligibilityEngine } from "./engine.ts";
import type { AnswerValue, PersonAnswers, Profile, Question } from "./types.ts";

/** One row of associated_persons as GET /profile returns it */
export interface BackendPerson {
	association_type?: string;
	lives_in_household?: boolean;
	[column: string]: unknown;
}

export interface BackendIncomeEntry {
	income_type: string;
	person_sort_order?: number | null;
	[column: string]: unknown;
}

/** The users row plus its relations, the shape of GET /profile and POST /profile */
export interface BackendProfile {
	associated_persons?: BackendPerson[];
	income_entries?: BackendIncomeEntry[];
	[column: string]: unknown;
}

const PARTNER_TYPES = ["Spouse", "Registered Partner", "Cohabiting Partner"];

const PARTNER_TYPE_BY_MARITAL_STATUS: Record<string, string> = {
	"maritalStatus-married": "Spouse",
	"maritalStatus-registeredPartnership": "Registered Partner",
};

const isPartner = (person: BackendPerson) =>
	person.lives_in_household !== false && PARTNER_TYPES.includes(person.association_type ?? "");
const isChild = (person: BackendPerson) =>
	person.lives_in_household !== false && person.association_type === "Child";

const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

const toAnswer = (question: Question, stored: unknown): AnswerValue | undefined => {
	if (isEmpty(stored)) {
		return undefined;
	}
	switch (question.datatype) {
		case "selection":
			return question.options.find((option) => option.storedValue === stored)?.value;
		case "date":
			return String(stored).slice(0, 10);
		case "euroAmount":
			return Number(stored);
		case "boolean":
			return Boolean(stored);
		default:
			return String(stored);
	}
};

const toStored = (question: Question, value: AnswerValue): unknown =>
	question.datatype === "selection"
		? question.options.find((option) => option.value === value)?.storedValue
		: value;

/** Data fields kept in a person's row, i.e. with a column and not a money entry */
const columnFields = (engine: EligibilityEngine) =>
	engine
		.dataFields()
		.map((field) => engine.question(field))
		.filter((question) => question.storage && !question.storage.incomeType);

const personAnswers = (engine: EligibilityEngine, row: Record<string, unknown>): PersonAnswers =>
	Object.fromEntries(
		columnFields(engine)
			.map((question) => [question.id, toAnswer(question, row[question.storage!.column])] as const)
			.filter(([, value]) => value !== undefined),
	) as PersonAnswers;

/** Reads the answers the knowledge base asks for out of a stored profile */
export const profileFromBackend = (engine: EligibilityEngine, backend: BackendProfile): Profile => {
	const persons = backend.associated_persons ?? [];
	const partner = persons.find(isPartner);
	const children = persons.filter(isChild);
	const answers = personAnswers(engine, backend);

	for (const question of engine.dataFields().map((field) => engine.question(field))) {
		const entry = backend.income_entries?.find(
			(candidate) => candidate.income_type === question.storage?.incomeType && candidate.person_sort_order == null,
		);
		const value = entry && toAnswer(question, entry[question.storage!.column]);
		if (value !== undefined) {
			answers[question.id] = value;
		}
	}

	// The household is not stored as such, but follows from the people living in it
	if (partner || children.length > 0 || backend.persons_in_household_count === 1) {
		answers.householdComposition = partner
			? children.length > 0
				? "householdComposition-coupleWithChildren"
				: "householdComposition-coupleNoChildren"
			: children.length > 0
				? "householdComposition-singleParent"
				: "householdComposition-single";
	}

	return {
		answers,
		partner: partner && personAnswers(engine, partner),
		children: children.map((child) => personAnswers(engine, child)),
	};
};

const storedColumns = (engine: EligibilityEngine, answers: PersonAnswers): Record<string, unknown> => {
	const columns: Record<string, unknown> = {};
	for (const question of columnFields(engine)) {
		if (answers[question.id] !== undefined) {
			columns[question.storage!.column] = toStored(question, answers[question.id]);
		}
	}
	return columns;
};

/**
 * The POST /profile payload that stores the answers. associated_persons is replaced as a
 * whole by the backend, so every existing person is sent along, updated where answered.
 */
export const backendPatch = (engine: EligibilityEngine, profile: Profile, backend: BackendProfile): BackendProfile => {
	const patch: BackendProfile = storedColumns(engine, profile.answers);

	const incomeEntries = engine
		.dataFields()
		.map((field) => engine.question(field))
		.filter((question) => question.storage?.incomeType && profile.answers[question.id] !== undefined)
		.map((question) => ({
			income_type: question.storage!.incomeType!,
			person_sort_order: null,
			[question.storage!.column]: toStored(question, profile.answers[question.id]),
		}));
	if (incomeEntries.length > 0) {
		patch.income_entries = incomeEntries;
	}

	// The backend renumbers sort_order from list order, which decides a person's slot on the
	// forms, so existing persons keep their position and new ones are appended
	const persons = backend.associated_persons ?? [];
	const partnerAnswers = profile.partner && Object.keys(profile.partner).length > 0 ? profile.partner : undefined;
	const children = profile.children ?? [];
	let childIndex = 0;
	const updated = persons.map((person) => {
		if (isPartner(person) && partnerAnswers) {
			return { ...person, ...storedColumns(engine, partnerAnswers) };
		}
		if (isChild(person)) {
			const child = children[childIndex++];
			return child ? { ...person, ...storedColumns(engine, child) } : person;
		}
		return person;
	});
	const newPartner =
		partnerAnswers && !persons.some(isPartner)
			? [
					{
						association_type:
							PARTNER_TYPE_BY_MARITAL_STATUS[String(profile.answers.maritalStatus)] ?? "Cohabiting Partner",
						lives_in_household: true,
						...storedColumns(engine, partnerAnswers),
					},
				]
			: [];
	const newChildren = children.slice(childIndex).map((child) => ({
		association_type: "Child",
		lives_in_household: true,
		...storedColumns(engine, child),
	}));
	const nextPersons = [...updated, ...newPartner, ...newChildren];
	if (JSON.stringify(nextPersons) !== JSON.stringify(persons)) {
		patch.associated_persons = nextPersons;
	}

	return patch;
};
