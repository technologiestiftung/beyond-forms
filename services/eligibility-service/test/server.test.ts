import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { server } from "../src/server.ts";

let base = "";

before(async () => {
	await new Promise<void>((resolve) => server.listen(0, resolve));
	base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
	server.close();
});

const post = async (path: string, body: unknown) => {
	const response = await fetch(base + path, { method: "POST", body: JSON.stringify(body) });
	return { status: response.status, body: await response.json() };
};

const storedProfile = {
	first_name: "Sabine",
	last_name: "Beispiel",
	date_of_birth: "1988-04-12",
	associated_persons: [{ association_type: "Child", lives_in_household: true, date_of_birth: "2018-03-01" }],
};

describe("eligibility-service", () => {
	it("answers health checks", async () => {
		assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: "ok" });
	});

	it("tells the chat which field of the form to ask next and where to store it", async () => {
		const { status, body } = await post("/applications/antrag_kinderzuschlag/progress", {
			profile: storedProfile,
			lang: "en",
		});
		assert.equal(status, 200);
		assert.equal(body.complete, false);
		assert.deepEqual(body.next, {
			field: "legalGender",
			individual: "citizen",
			question: "Which gender is entered in your ID?",
			datatype: "selection",
			options: [
				{ label: "Female", stored_value: "Female" },
				{ label: "Male", stored_value: "Male" },
				{ label: "Diverse", stored_value: "Diverse" },
			],
			stored_as: { column: "legal_gender", row: "users" },
		});
	});

	it("reports the computed eligibility instead of leaving it to the language model", async () => {
		const { body } = await post("/eligibility", { profile: storedProfile, lang: "en" });
		const kinderzuschlag = body.benefits.find((benefit: { id: string }) => benefit.id === "kinderzuschlag");
		assert.equal(kinderzuschlag.status, "missingData");
		assert.equal(kinderzuschlag.application_form, "antrag_kinderzuschlag");
		assert.ok(body.next_question.question);
	});

	it("rejects unknown forms", async () => {
		assert.equal((await post("/applications/antrag_unbekannt/progress", {})).status, 404);
	});
});
