import { describe, it, expect, beforeEach } from "vitest";
import { useDocumentReviewStore } from "./useDocumentReviewStore";

describe("useDocumentReviewStore", () => {
	beforeEach(() => {
		useDocumentReviewStore.setState({
			extractedFields: [],
		});
	});

	it("should correctly track checkbox states for extracted fields", () => {
		const store = useDocumentReviewStore.getState();

		store.setExtractedFields([
			{ id: "field_1", key: "first_name", value: "John", checked: true },
			{ id: "field_2", key: "last_name", value: "Doe", checked: false },
		]);

		let state = useDocumentReviewStore.getState();
		expect(state.extractedFields.find((f) => f.id === "field_1")?.checked).toBe(
			true,
		);
		expect(state.extractedFields.find((f) => f.id === "field_2")?.checked).toBe(
			false,
		);

		store.toggleFieldSelection("field_2");
		state = useDocumentReviewStore.getState();
		expect(state.extractedFields.find((f) => f.id === "field_2")?.checked).toBe(
			true,
		);

		store.toggleFieldSelection("field_1");
		state = useDocumentReviewStore.getState();
		expect(state.extractedFields.find((f) => f.id === "field_1")?.checked).toBe(
			false,
		);
	});

	it("should exclude unchecked fields from the submission payload", () => {
		const store = useDocumentReviewStore.getState();

		store.setExtractedFields([
			{ id: "field_1", key: "first_name", value: "John", checked: true },
			{ id: "field_2", key: "last_name", value: "Doe", checked: false },
			{ id: "field_3", key: "city", value: "Berlin", checked: true },
		]);

		const payload = store.getSubmissionPayload();

		expect(payload).toHaveLength(2);
		expect(payload).toContainEqual({ key: "first_name", value: "John" });
		expect(payload).toContainEqual({ key: "city", value: "Berlin" });
		expect(
			payload.find(
				(f: { key: string; value: string }) => f.key === "last_name",
			),
		).toBeUndefined();
	});
});
