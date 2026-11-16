export type AnswerValue = string | number | boolean;

/** Answers keyed by data field id (local name in the bf: namespace, e.g. "householdComposition") */
export type PersonAnswers = Record<string, AnswerValue>;

export interface Profile {
	answers: PersonAnswers;
	/** Only taken into account when the rules give the applicant a partner (couples) */
	partner?: PersonAnswers;
	children?: PersonAnswers[];
}

/** "citizen", "partner" or "child0", "child1", ... */
export type IndividualId = string;

export interface FieldRef {
	field: string;
	individual: IndividualId;
}

export type Status = "eligible" | "ineligible" | "missingData";

export interface Reason {
	key?: string;
	message?: string;
}

export interface BenefitResult {
	id: string;
	status: Status;
	/** For ineligible: violated rules, most decisive first. For eligible: the benefit's eligible reason. */
	reasons: Reason[];
	/** Data fields still needed to decide this benefit */
	missing: string[];
}

export interface MatchResult {
	benefits: BenefitResult[];
	/** The data field missed by the most undecided benefits */
	nextQuestion?: string;
	missingCount: number;
	/** Facts the rules derived about the applicant, e.g. "wohngeldAmount" */
	derived: Record<string, AnswerValue>;
}

/** "country" stores an ISO 3166-1 alpha-2 code */
export type Datatype = "selection" | "boolean" | "date" | "euroAmount" | "childList" | "text" | "country";

export interface AnswerOption {
	id: string;
	code?: string;
	label: string;
	value: AnswerValue;
	/** How the backend profile stores this option, e.g. "Married" */
	storedValue?: string;
}

/** Where the backend profile keeps a field: a column of the person's row, or a typed money entry */
export interface Storage {
	column: string;
	incomeType?: string;
}

export interface Question {
	id: string;
	datatype: Datatype;
	category: string;
	question: string;
	tip?: string;
	options: AnswerOption[];
	storage?: Storage;
	section?: string;
}

export interface ApplicationInfo {
	id: string;
	label: string;
	form: string;
	benefit?: string;
}

export interface ApplicationProgress {
	id: string;
	form: string;
	complete: boolean;
	/** Fields still needed for the form, in the order the form asks them */
	missing: FieldRef[];
	/** Answers that break a rule of the form, e.g. a malformed IBAN */
	invalid: (FieldRef & { message?: string })[];
	/** Invalid answers first, then the first missing field */
	next?: FieldRef;
	/** Every field the form asks for given the answers so far, answered or not, in form order */
	steps: FieldRef[];
	answeredCount: number;
	derived: Record<string, AnswerValue>;
}

export interface BenefitInfo {
	id: string;
	label: string;
	leikaId?: string;
	legalBasis?: string;
	providingAgency?: string;
	applicationForm?: string;
}

export interface MatchOptions {
	/** Evaluation date as YYYY-MM-DD */
	today: string;
	lang?: string;
}
