import { readdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import {
	EligibilityEngine,
	profileFromBackend,
	type BackendProfile,
	type FieldRef,
} from "../../../libs/eligibility-engine/src/index.ts";

const KNOWLEDGE_DIR = resolve(process.env.KNOWLEDGE_DIR ?? join(import.meta.dirname, "../../../knowledge"));

const turtleFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return turtleFiles(path);
		}
		return entry.name.endsWith(".ttl") ? [path] : [];
	});

export const engine = new EligibilityEngine(turtleFiles(KNOWLEDGE_DIR).map((file) => readFileSync(file, "utf8")));

const today = () => new Date().toISOString().slice(0, 10);

interface RequestBody {
	profile?: BackendProfile;
	lang?: string;
}

/** Everything a chat agent needs to ask for one field and to store the answer */
const describe = ({ field, individual }: FieldRef, lang: string) => {
	const question = engine.question(field, lang, individual);
	return {
		field,
		individual,
		question: question.question,
		tip: question.tip,
		datatype: question.datatype,
		options: question.options.map((option) => ({ label: option.label, stored_value: option.storedValue })),
		stored_as: question.storage && {
			column: question.storage.column,
			...(question.storage.incomeType && { income_entries_type: question.storage.incomeType }),
			row:
				individual === "citizen"
					? "users"
					: `associated_persons (${individual === "partner" ? "the partner" : `child ${Number(individual.slice(5)) + 1}`})`,
		},
	};
};

const eligibility = async ({ profile = {}, lang = "de" }: RequestBody) => {
	const result = await engine.match(profileFromBackend(engine, profile), { today: today(), lang });
	const labels = new Map(engine.benefits(lang).map((benefit) => [benefit.id, benefit]));
	return {
		benefits: result.benefits.map((benefit) => ({
			id: benefit.id,
			label: labels.get(benefit.id)?.label,
			application_form: labels.get(benefit.id)?.applicationForm,
			status: benefit.status,
			reasons: benefit.reasons.map((reason) => reason.message),
		})),
		next_question: result.nextQuestion && describe({ field: result.nextQuestion, individual: "citizen" }, lang),
		derived: result.derived,
	};
};

const progress = async (formType: string, { profile = {}, lang = "de" }: RequestBody) => {
	const application = engine.applications(lang).find(({ form, id }) => form === formType || id === formType);
	if (!application) {
		return undefined;
	}
	const result = await engine.progress(profileFromBackend(engine, profile), application.id, { today: today(), lang });
	return {
		form: result.form,
		label: application.label,
		complete: result.complete,
		missing_count: result.missing.length,
		invalid: result.invalid.map((ref) => ({ ...describe(ref, lang), message: ref.message })),
		next: result.next && describe(result.next, lang),
		missing: result.missing.map((ref) => ({ field: ref.field, individual: ref.individual })),
	};
};

const readJson = async (request: IncomingMessage): Promise<RequestBody> => {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(chunk as Buffer);
	}
	return chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
};

const send = (response: ServerResponse, status: number, body: unknown) => {
	response.writeHead(status, { "Content-Type": "application/json" });
	response.end(JSON.stringify(body));
};

export const server = createServer(async (request, response) => {
	try {
		const { pathname, searchParams } = new URL(request.url ?? "/", "http://localhost");
		if (request.method === "GET" && pathname === "/health") {
			return send(response, 200, { status: "ok" });
		}
		if (request.method === "GET" && pathname === "/applications") {
			return send(response, 200, engine.applications(searchParams.get("lang") ?? "de"));
		}
		if (request.method === "POST" && pathname === "/eligibility") {
			return send(response, 200, await eligibility(await readJson(request)));
		}
		const progressPath = pathname.match(/^\/applications\/([^/]+)\/progress$/);
		if (request.method === "POST" && progressPath) {
			const result = await progress(decodeURIComponent(progressPath[1]), await readJson(request));
			return result ? send(response, 200, result) : send(response, 404, { error: "Unknown application" });
		}
		send(response, 404, { error: "Not found" });
	} catch (error) {
		send(response, 400, { error: (error as Error).message });
	}
});

if (import.meta.main) {
	const port = Number(process.env.PORT ?? 8090);
	server.listen(port, () => console.log(`eligibility-service listening on ${port}`));
}
