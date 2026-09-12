import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsView } from "./SettingsView";
import { BrowserRouter } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfileStore } from "../../store/useProfileStore";
import { setDesktopViewport } from "../../tests/viewport";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router-dom")>();
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

const mockDeleteProfile = vi.fn();

vi.mock("../../services/profile", () => ({
	profileService: {
		deleteProfile: () => mockDeleteProfile(),
	},
}));

vi.mock("../../store/useAuthStore", () => ({
	useAuthStore: vi.fn(),
}));

vi.mock("../../store/useProfileStore", () => ({
	useProfileStore: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
	return render(ui, { wrapper: BrowserRouter });
};

describe("SettingsView - Unified Single Page", () => {
	const mockLogout = vi.fn();
	const mockResetProfileStore = vi.fn();

	beforeEach(() => {
		setDesktopViewport(true);
		vi.clearAllMocks();
		mockDeleteProfile.mockResolvedValue(undefined);

		// Mock useAuthStore selector for logout function
		(useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
			(selector: (state: { logout: () => void }) => unknown) => {
				return selector({ logout: mockLogout });
			},
		);

		// Mock useProfileStore selector for reset function
		(useProfileStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
			(selector: (state: { reset: () => void }) => unknown) => {
				return selector({ reset: mockResetProfileStore });
			},
		);
	});

	it("asserts unified rendering of settings sections and fields", () => {
		renderWithRouter(<SettingsView />);

		// Renders main title
		expect(
			screen.getByRole("heading", { name: "settings.title" }),
		).toBeInTheDocument();

		// Asserts non-functional inputs are completely absent
		expect(
			screen.queryByLabelText("settings.fields.language"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("settings.options.formal"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("settings.options.informal"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("settings.fields.need_assistance"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("settings.consents.save_data"),
		).not.toBeInTheDocument();

		// Asserts account actions are rendered
		expect(screen.getByTestId("logout-trigger")).toBeInTheDocument();
		expect(screen.getByTestId("delete-account-trigger")).toBeInTheDocument();
	});

	it("keeps the mobile layout on small screens", () => {
		setDesktopViewport(false);
		renderWithRouter(<SettingsView />);

		const deleteTrigger = screen.getByTestId("delete-account-trigger");
		expect(deleteTrigger).toHaveTextContent("actions.delete_account");
		expect(screen.queryByText("settings.subtitle")).not.toBeInTheDocument();
	});

	it("shows the desktop settings cards on wide screens", () => {
		renderWithRouter(<SettingsView />);

		expect(screen.getByText("settings.subtitle")).toBeInTheDocument();
		expect(screen.getByTestId("delete-account-trigger")).toHaveTextContent(
			"actions.delete_account",
		);
		expect(
			screen.getByText("settings.account.delete_hint"),
		).toBeInTheDocument();
	});

	it("triggers deep logout and resets stores on click", async () => {
		renderWithRouter(<SettingsView />);

		fireEvent.click(screen.getByTestId("logout-trigger"));

		await waitFor(() => {
			expect(mockLogout).toHaveBeenCalled();
			expect(mockResetProfileStore).toHaveBeenCalled();
			expect(mockNavigate).toHaveBeenCalledWith("/");
		});
	});

	it("displays account deletion warning dialog and confirms deletion", async () => {
		renderWithRouter(<SettingsView />);

		// Dialog shouldn't be visible initially
		expect(
			screen.queryByText("settings.modals.delete.title"),
		).not.toBeInTheDocument();

		// Click delete button
		const deleteTrigger = screen.getByTestId("delete-account-trigger");
		fireEvent.click(deleteTrigger);

		// Dialog is now visible
		expect(
			screen.getByText("settings.modals.delete.title"),
		).toBeInTheDocument();

		// Confirm delete
		const confirmDeleteBtn = screen.getByRole("button", {
			name: "settings.modals.delete.confirm",
		});
		fireEvent.click(confirmDeleteBtn);

		await waitFor(() => {
			expect(mockDeleteProfile).toHaveBeenCalled();
			expect(mockLogout).toHaveBeenCalled();
			expect(mockResetProfileStore).toHaveBeenCalled();
			expect(mockNavigate).toHaveBeenCalledWith("/");
		});
	});

	it("blocks account deletion and displays error if service fails", async () => {
		mockDeleteProfile.mockRejectedValue(new Error("Database error"));

		renderWithRouter(<SettingsView />);

		const deleteTrigger = screen.getByTestId("delete-account-trigger");
		fireEvent.click(deleteTrigger);

		const confirmDeleteBtn = screen.getByRole("button", {
			name: "settings.modals.delete.confirm",
		});
		fireEvent.click(confirmDeleteBtn);

		await waitFor(() => {
			expect(mockDeleteProfile).toHaveBeenCalled();
		});

		// Verify it does NOT logout and does NOT reload
		expect(mockLogout).not.toHaveBeenCalled();
		expect(mockNavigate).not.toHaveBeenCalled();

		// Dialog shows the error message
		expect(
			screen.getByText("settings.modals.delete.error"),
		).toBeInTheDocument();
	});
});
