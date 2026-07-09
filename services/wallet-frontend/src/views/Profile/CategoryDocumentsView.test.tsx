import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryDocumentsView } from "./CategoryDocumentsView";
import { BrowserRouter } from "react-router-dom";
import { useProfile } from "../../hooks/useProfile";
import { useProfileStore } from "../../store/useProfileStore";

// Mock useParams and useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useParams: () => ({ categoryId: "identity" }),
		useNavigate: () => mockNavigate,
	};
});

// Mock hooks
vi.mock("../../hooks/useProfile", () => ({
	useProfile: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
	return render(ui, { wrapper: BrowserRouter });
};

describe("CategoryDocumentsView", () => {
	const mockRefetch = vi.fn();
	const mockDeleteDocument = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		useProfileStore.getState().reset();

		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			isLoading: false,
			isError: false,
			refetch: mockRefetch,
			deleteDocument: mockDeleteDocument,
		});
	});

	it("renders category title, description, and handles back button correctly", () => {
		renderWithRouter(<CategoryDocumentsView />);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"docs.groups.identity",
		);
		expect(
			screen.getByText("docs.group_descriptions.identity"),
		).toBeInTheDocument();

		// Check back button navigates back to Hub View
		const backBtn = screen.getByLabelText("docs.back_to_overview_aria");
		expect(backBtn).toBeInTheDocument();
		fireEvent.click(backBtn);
		expect(mockNavigate).toHaveBeenCalledWith("/profile/documents");
	});

	it("displays loading indicator while fetching", () => {
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			isLoading: true,
			isError: false,
			refetch: mockRefetch,
		});

		renderWithRouter(<CategoryDocumentsView />);
		expect(screen.getByTestId("documents-loading")).toBeInTheDocument();
	});

	it("displays error block on failure and allows retry", () => {
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			isLoading: false,
			isError: true,
			refetch: mockRefetch,
		});

		renderWithRouter(<CategoryDocumentsView />);
		expect(screen.getByText("common.error_title")).toBeInTheDocument();
		const retryBtn = screen.getByRole("button", { name: "common.retry" });
		expect(retryBtn).toBeInTheDocument();

		fireEvent.click(retryBtn);
		expect(mockRefetch).toHaveBeenCalledTimes(1);
	});

	it("renders slots list and ensures deletion trash icons are not rendered on this view", () => {
		useProfileStore.getState().setDocuments([
			{
				id: "doc-123",
				name: "ID.pdf",
				type: "ID_CARD",
				status: "VERIFIED",
				uploadDate: new Date().toISOString(),
				confidence: 0.98,
			},
		]);

		renderWithRouter(<CategoryDocumentsView />);

		// Check that id_card slot is rendered in JSDOM (translated key format)
		expect(screen.getByText("docs.slots.id_card")).toBeInTheDocument();

		// Trash button should NOT be visible
		const trashBtn = screen.queryByTestId("delete-btn-doc-123");
		expect(trashBtn).not.toBeInTheDocument();
	});
});
