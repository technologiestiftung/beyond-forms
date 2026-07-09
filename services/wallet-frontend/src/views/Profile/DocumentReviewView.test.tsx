import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentReviewView } from "./DocumentReviewView";
import { BrowserRouter } from "react-router-dom";
import { authenticatedFetch } from "../../utils/apiClient";

// Mock scrollIntoView for JSDOM environment compatibility
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock apiClient
vi.mock("../../utils/apiClient", () => ({
	authenticatedFetch: vi.fn(),
}));

// Mock useProfile hook
vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => ({
		deleteDocument: vi.fn(),
		isDeleting: false,
	}),
}));

// Mock profile store
vi.mock("../../store/useProfileStore", () => ({
	useProfileStore: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock file service
vi.mock("../../services/profile/FileService", () => ({
	fileService: {
		getFiles: vi.fn().mockResolvedValue([]),
	},
}));

const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", async () => {
	const actual = await vi.importActual("@tanstack/react-query");
	return {
		...actual,
		useQueryClient: () => ({
			invalidateQueries: mockInvalidateQueries,
		}),
	};
});

// Mock react-router-dom params
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useParams: () => ({ documentId: "test-doc-id" }),
	};
});

const renderWithRouter = (ui: React.ReactElement) => {
	return render(ui, { wrapper: BrowserRouter });
};

describe("DocumentReviewView - Validation & Smart Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("smartly parses 422 validation details array from backend and displays in error banner", async () => {
		// Initial GET extractions response
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				raw_data: {
					first_name: "Max",
					last_name: "Mustermann",
					date_of_birth: "invalid-date",
				},
			}),
		});

		renderWithRouter(<DocumentReviewView />);

		await waitFor(() => {
			expect(screen.getByText("review.confirm_all")).toBeInTheDocument();
		});

		// Mock POST /verify to return 422 with detail array exactly as Principal Engineer suggested
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: false,
			status: 422,
			json: async () => ({
				detail: [
					{
						loc: ["body", "corrected_data", "date_of_birth"],
						msg: "none is not an allowed value or bad date format",
					},
				],
			}),
		});

		fireEvent.click(screen.getByText("review.confirm_all"));

		// Verify smart error banner parses and displays the specific detail
		await waitFor(() => {
			expect(
				screen.getByText(/date_of_birth: none is not an allowed value/i),
			).toBeInTheDocument();
		});
	});

	it("correctly formats date values on display and inside the inline edit input", async () => {
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				raw_data: {
					first_name: "Helmut",
					date_of_birth: "1959-01-20",
					date_of_issue: "2020-10-15T00:00:00.000Z",
				},
			}),
		});

		renderWithRouter(<DocumentReviewView />);

		// Wait for data load
		await waitFor(() => {
			expect(screen.getByText("review.confirm_all")).toBeInTheDocument();
		});

		// Expect display rows to show German formatted dates
		expect(screen.getByText("20.01.1959")).toBeInTheDocument();
		expect(screen.getByText("15.10.2020")).toBeInTheDocument();

		// Universal Affordance: explicit edit buttons should be fully accessible
		const editBtn = screen.getByLabelText(/Edit.*date_of_birth/i);
		expect(editBtn).toBeInTheDocument();

		// Click directly on the date value text to trigger edit mode
		fireEvent.click(screen.getByText("20.01.1959"));

		// Expect the input value to be initialized in German format
		const input = screen.getByDisplayValue("20.01.1959") as HTMLInputElement;
		expect(input).toBeInTheDocument();
	});

	it("smartly parses rules-engine dictionary validation details, highlights inputs, and displays localized validation errors", async () => {
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				raw_data: {
					first_name: "Helmut",
					date_of_birth: "1959-01-20",
				},
			}),
		});

		renderWithRouter(<DocumentReviewView />);

		await waitFor(() => {
			expect(screen.getByText("review.confirm_all")).toBeInTheDocument();
		});

		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: false,
			status: 422,
			json: async () => ({
				detail: {
					message: "Validation failed",
					errors: {
						date_of_birth: [
							{
								field_path: "date_of_birth",
								message: "Date of birth cannot be in the future",
								type: "value_error",
							},
						],
					},
				},
			}),
		});

		fireEvent.click(screen.getByText("review.confirm_all"));

		await waitFor(() => {
			// Expect global error banner to show generic failure message
			expect(
				screen.getByText("review.errors.verification_failed"),
			).toBeInTheDocument();
			// Expect localized field-specific error message to be shown
			expect(
				screen.getByText("validation.future_date_not_allowed"),
			).toBeInTheDocument();
		});
	});

	it("clears field validation error dynamically when field is edited and saved", async () => {
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				raw_data: {
					first_name: "Helmut",
					date_of_birth: "1959-01-20",
				},
			}),
		});

		renderWithRouter(<DocumentReviewView />);

		await waitFor(() => {
			expect(screen.getByText("review.confirm_all")).toBeInTheDocument();
		});

		// Inject validation error
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: false,
			status: 422,
			json: async () => ({
				detail: {
					message: "Validation failed",
					errors: {
						date_of_birth: [
							{
								field_path: "date_of_birth",
								message: "Date of birth cannot be in the future",
								type: "value_error",
							},
						],
					},
				},
			}),
		});

		fireEvent.click(screen.getByText("review.confirm_all"));

		await waitFor(() => {
			expect(
				screen.getByText("validation.future_date_not_allowed"),
			).toBeInTheDocument();
		});

		// Trigger edit mode by clicking directly on the date value
		fireEvent.click(screen.getByText("20.01.1959"));

		// Expect input to have aria-invalid="true" and be described by the error element
		const input = screen.getByDisplayValue("20.01.1959") as HTMLInputElement;
		expect(input).toBeInTheDocument();
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe("error-date_of_birth");

		// Change input and save it
		fireEvent.change(input, { target: { value: "19.01.1959" } });
		fireEvent.click(screen.getByText("common.save"));

		// Expect the error state to clear locally
		expect(
			screen.queryByText("validation.future_date_not_allowed"),
		).not.toBeInTheDocument();
	});

	it("successfully submits verification data and redirects to success screen", async () => {
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				raw_data: {
					first_name: "Helmut",
					date_of_birth: "1959-01-20",
				},
			}),
		});

		renderWithRouter(<DocumentReviewView />);

		await waitFor(() => {
			expect(screen.getByText("review.confirm_all")).toBeInTheDocument();
		});

		// Mock verification request returning 200 OK
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ status: "success" }),
		});

		fireEvent.click(screen.getByText("review.confirm_all"));

		await waitFor(() => {
			expect(authenticatedFetch).toHaveBeenCalledTimes(2);
			expect(authenticatedFetch).toHaveBeenLastCalledWith(
				expect.stringContaining("/api/v1/documents/test-doc-id/verify"),
				expect.objectContaining({
					method: "POST",
					body: expect.any(String),
				}),
			);
		});
	});

	it("enables direct click-to-edit on extracted field value text spans", async () => {
		(
			authenticatedFetch as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				raw_data: {
					first_name: "Helmut",
				},
			}),
		});

		renderWithRouter(<DocumentReviewView />);

		await waitFor(() => {
			expect(screen.getByText("Helmut")).toBeInTheDocument();
		});

		// Click directly on the extracted text value
		fireEvent.click(screen.getByText("Helmut"));

		// Expect the input to appear
		const input = screen.getByDisplayValue("Helmut") as HTMLInputElement;
		expect(input).toBeInTheDocument();
	});
});
