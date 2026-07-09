import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentsOverview } from "./DocumentsOverview";
import { BrowserRouter } from "react-router-dom";
import { useProfile } from "../../hooks/useProfile";
import { useProfileStore } from "../../store/useProfileStore";

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

	it("renders the 4 main document categories and triggers navigation on click", () => {
		renderWithRouter(<DocumentsOverview />);

		const identityCard = screen.getByRole("button", {
			name: /docs\.groups\.identity/,
		});
		expect(identityCard).toBeInTheDocument();
		expect(screen.getByText("docs.groups.income")).toBeInTheDocument();
		expect(screen.getByText("docs.groups.housing")).toBeInTheDocument();
		expect(screen.getByText("docs.groups.declarations")).toBeInTheDocument();

		// Click on category card to navigate
		fireEvent.click(identityCard);
		expect(mockNavigate).toHaveBeenCalledWith(
			"/profile/documents/category/identity",
		);
	});

	it("does not render the 'Dokument hinzufügen' upload button", () => {
		renderWithRouter(<DocumentsOverview />);
		expect(screen.queryByText("Dokument hinzufügen")).toBeNull();
	});
});
