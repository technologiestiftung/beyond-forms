declare module "rdf-ext" {
	import type { DataFactory, DatasetCore, Quad } from "@rdfjs/types";

	const rdf: DataFactory & { dataset(quads?: Iterable<Quad>): DatasetCore };
	export default rdf;
}

declare module "shacl-engine" {
	import type { DataFactory, DatasetCore, Term } from "@rdfjs/types";

	interface Pointer {
		term: Term;
		out(predicates: Term[]): { terms: Term[] };
	}

	export interface ValidationResult {
		constraintComponent: Term;
		severity: Term;
		focusNode: { term: Term };
		path: { predicates: Term[] }[];
		message: { value: string; language: string }[];
		shape: { ptr: Pointer };
	}

	export class Validator {
		constructor(shapes: DatasetCore, options: { factory: DataFactory });
		validate(data: { dataset: DatasetCore }): Promise<{ conforms: boolean; results: ValidationResult[] }>;
	}
}
