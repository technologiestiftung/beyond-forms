import { create } from "zustand";

export interface ExtractedField {
	id: string;
	key: string;
	value: string;
	checked: boolean;
}

interface DocumentReviewState {
	extractedFields: ExtractedField[];
	setExtractedFields: (fields: ExtractedField[]) => void;
	toggleFieldSelection: (id: string) => void;
	updateFieldValue: (id: string, newValue: string) => void;
	getSubmissionPayload: () => { key: string; value: string }[];
}

export const useDocumentReviewStore = create<DocumentReviewState>(
	(set, get) => ({
		extractedFields: [],
		setExtractedFields: (fields) => set({ extractedFields: fields }),
		toggleFieldSelection: (id) =>
			set((state) => ({
				extractedFields: state.extractedFields.map((field) =>
					field.id === id ? { ...field, checked: !field.checked } : field,
				),
			})),
		updateFieldValue: (id, newValue) =>
			set((state) => ({
				extractedFields: state.extractedFields.map((field) =>
					field.id === id ? { ...field, value: newValue } : field,
				),
			})),
		getSubmissionPayload: () => {
			const state = get();
			return state.extractedFields
				.filter((field) => field.checked)
				.map(({ key, value }) => ({ key, value }));
		},
	}),
);
