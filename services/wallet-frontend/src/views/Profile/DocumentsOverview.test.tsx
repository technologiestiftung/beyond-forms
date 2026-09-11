import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DocumentsOverview } from "./DocumentsOverview";
import { BrowserRouter } from "react-router-dom";
import { useProfile } from "../../hooks/useProfile";
import { useProfileStore } from "../../store/useProfileStore";
import { setDesktopViewport } from "../../tests/viewport";
import { usePendingUploadStore } from "../../store/usePendingUploadStore";

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

// Mock hook
vi.mock("../../hooks/useProfile", () => ({
	useProfile: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
	return render(ui, { wrapper: BrowserRouter });
};

describe("DocumentsOverview", () => {
	const mockRefetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		setDesktopViewport(true);
		usePendingUploadStore.getState().takePendingFile();
		useProfileStore.getState().reset();

		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			isLoading: false,
			isError: false,
			refetch: mockRefetch,
		});
	});

	it("calls useProfile with refetchOnMount always on mount to ensure fresh document list", () => {
		renderWithRouter(<DocumentsOverview />);
		expect(useProfile).toHaveBeenCalledWith({ refetchOnMount: "always" });
	});

	it("renders loading state while fetching documents", () => {
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			isLoading: true,
			isError: false,
			refetch: mockRefetch,
		});

		renderWithRouter(<DocumentsOverview />);
		expect(screen.getByTestId("documents-loading")).toBeInTheDocument();
	});

	it("displays error message and retry button on fetch failure", () => {
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			isLoading: false,
			isError: true,
			refetch: mockRefetch,
		});

		renderWithRouter(<DocumentsOverview />);
		expect(screen.getByText("common.error_title")).toBeInTheDocument();
		const retryBtn = screen.getByRole("button", { name: "common.retry" });
		expect(retryBtn).toBeInTheDocument();

		fireEvent.click(retryBtn);
		expect(mockRefetch).toHaveBeenCalledTimes(1); // Called on button click
	});

	it("renders the main document categories and triggers navigation on click", () => {
		setDesktopViewport(false);
		renderWithRouter(<DocumentsOverview />);

		const categoryList = within(screen.getByTestId("documents-category-list"));
		const identityCard = categoryList.getByRole("button", {
			name: /docs\.groups\.identity/,
		});
		expect(identityCard).toBeInTheDocument();
		expect(categoryList.getByText("docs.groups.income")).toBeInTheDocument();
		expect(categoryList.getByText("docs.groups.housing")).toBeInTheDocument();
		expect(
			categoryList.getByText("docs.groups.declarations"),
		).toBeInTheDocument();

		// Click on category card to navigate
		fireEvent.click(identityCard);
		expect(mockNavigate).toHaveBeenCalledWith(
			"/profile/documents/category/identity",
		);
	});

	it("switches the desktop detail panel without navigating when a category is picked in the sidebar", () => {
		renderWithRouter(<DocumentsOverview />);

		const workspace = within(screen.getByTestId("documents-workspace"));
		expect(
			workspace.getByTestId("document-category-nav-identity"),
		).toHaveAttribute("aria-current", "true");

		fireEvent.click(workspace.getByTestId("document-category-nav-housing"));

		expect(mockNavigate).not.toHaveBeenCalled();
		expect(
			workspace.getByTestId("document-category-nav-housing"),
		).toHaveAttribute("aria-current", "true");
		expect(
			workspace.getByTestId("document-category-nav-identity"),
		).not.toHaveAttribute("aria-current");
		expect(workspace.getByRole("heading", { level: 2 })).toHaveTextContent(
			"docs.groups.housing",
		);
	});

	it("opens the upload flow over the documents view on desktop", () => {
		renderWithRouter(<DocumentsOverview />);

		const workspace = within(screen.getByTestId("documents-workspace"));
		fireEvent.click(workspace.getByText("docs.add_document"));

		expect(mockNavigate).toHaveBeenCalledWith(
			"/profile/personal/upload?origin=hub&category=identity",
			expect.objectContaining({
				state: expect.objectContaining({
					backgroundLocation: expect.objectContaining({
						pathname: expect.any(String),
					}),
				}),
			}),
		);
	});

	it("opens the upload flow over the documents view when a document row is picked", () => {
		renderWithRouter(<DocumentsOverview />);

		const workspace = within(screen.getByTestId("documents-workspace"));
		fireEvent.click(workspace.getByTestId("slot-btn-id_card"));

		expect(mockNavigate).toHaveBeenCalledWith(
			"/profile/personal/upload?origin=hub&type=id_card",
			expect.objectContaining({
				state: expect.objectContaining({
					backgroundLocation: expect.anything(),
				}),
			}),
		);
	});

	it("hands a dropped file to the upload flow", () => {
		renderWithRouter(<DocumentsOverview />);

		const file = new File(["pdf"], "ausweis.pdf", { type: "application/pdf" });
		fireEvent.drop(screen.getByTestId("document-drop-target"), {
			dataTransfer: { files: [file] },
		});

		expect(usePendingUploadStore.getState().pendingFile).toBe(file);
		expect(mockNavigate).toHaveBeenCalledWith(
			"/profile/personal/upload?origin=hub&category=identity",
			expect.objectContaining({
				state: expect.objectContaining({
					backgroundLocation: expect.anything(),
				}),
			}),
		);
	});

	it("does not render the 'Dokument hinzufügen' upload button in the mobile category list", () => {
		setDesktopViewport(false);
		renderWithRouter(<DocumentsOverview />);
		expect(
			within(screen.getByTestId("documents-category-list")).queryByText(
				"Dokument hinzufügen",
			),
		).toBeNull();
	});
});
