import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatenPrufenForm } from "./DatenPrufenForm";
import { authenticatedFetch } from "../../utils/apiClient";
import { useDocumentReviewStore } from "../../store/useDocumentReviewStore";

vi.mock("../../utils/apiClient", () => ({
	authenticatedFetch: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string } | string) =>
			typeof options === "string"
				? options
				: options?.defaultValue ||
					key.split(".").pop()?.replace(/_/g, " ") ||
					key,
	}),
}));

describe("DatenPrufenForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useDocumentReviewStore.setState({ extractedFields: [] });
	});

	it("shows loading state initially", () => {
		vi.mocked(authenticatedFetch).mockImplementation(
			() => new Promise(() => {}),
		);

		const { container } = render(<DatenPrufenForm documentId="doc-1" />);

		// Look for the spinner
		const spinner = container.querySelector(".animate-spin");
		expect(spinner).toBeInTheDocument();
	});

	it("renders extracted data and green checkmarks", async () => {
		vi.mocked(authenticatedFetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				raw_data: {
					first_name: "John",
					last_name: "Doe",
				},
			}),
		} as Response);

		render(<DatenPrufenForm documentId="doc-1" />);

		await waitFor(() => {
			expect(screen.getByText("John")).toBeInTheDocument();
		});
		expect(screen.getByText("Doe")).toBeInTheDocument();

		// Check for keys (capitalized or replaced underscores)
		expect(screen.getByText(/first name/i)).toBeInTheDocument();
		expect(screen.getByText(/last name/i)).toBeInTheDocument();
	});

	it("displays a warning banner if user_error_code is present", async () => {
		vi.mocked(authenticatedFetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				raw_data: { field: "value" },
				user_error_code: "PAGINATION_MISSING_PAGES",
			}),
		} as Response);

		render(<DatenPrufenForm documentId="doc-2" />);

		await waitFor(() => {
			expect(screen.getByText(/Überprüfung empfohlen/i)).toBeInTheDocument();
		});
		expect(
			screen.getByText(/Seiten dieses Dokuments fehlen/i),
		).toBeInTheDocument();
	});

	it("allows editing fields", async () => {
		vi.mocked(authenticatedFetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				raw_data: { name: "Alice" },
			}),
		} as Response);

		render(<DatenPrufenForm documentId="doc-3" />);

		await waitFor(() => {
			expect(screen.getByText("Alice")).toBeInTheDocument();
		});

		const editBtn = screen.getByRole("button", { name: /Edit|bearbeiten/i });
		expect(editBtn).toBeInTheDocument();
		fireEvent.click(editBtn);

		const input = screen.getByRole("textbox");
		expect(input).toBeInTheDocument();
		expect(input).toHaveValue("Alice");

		fireEvent.change(input, { target: { value: "Alicia" } });

		const saveButton = screen.getByRole("button", { name: /Save/i });
		fireEvent.click(saveButton);

		// After saving, input should be gone and new text should be there
		await waitFor(() => {
			expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
		});
		expect(screen.getByText("Alicia")).toBeInTheDocument();
	});

	it("allows direct click-to-edit by clicking on extracted field value text", async () => {
		vi.mocked(authenticatedFetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				raw_data: { nickname: "Bob" },
			}),
		} as Response);

		render(<DatenPrufenForm documentId="doc-4" />);

		await waitFor(() => {
			expect(screen.getByText("Bob")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("Bob"));

		const input = screen.getByRole("textbox");
		expect(input).toBeInTheDocument();
		expect(input).toHaveValue("Bob");
	});
});
