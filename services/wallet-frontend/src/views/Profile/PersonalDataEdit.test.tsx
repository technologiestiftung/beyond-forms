import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PersonalDataEdit } from "./PersonalDataEdit";
import { BrowserRouter } from "react-router-dom";
import { useProfile } from "../../hooks/useProfile";

vi.mock("../../hooks/useProfile", () => ({
	useProfile: vi.fn(),
}));

const { mockNavigate } = vi.hoisted(() => ({
	mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
	const mod = await importOriginal<typeof import("react-router-dom")>();
	return {
		...mod,
		useNavigate: () => mockNavigate,
	};
});

const renderWithRouter = (ui: React.ReactElement) => {
	return render(ui, { wrapper: BrowserRouter });
};

describe("PersonalDataEdit - Simplified Layout", () => {
	const mockUpdateSection = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {
				personalData: {
					firstName: "Sandor",
					lastName: "Klaro",
					dateOfBirth: "1955-01-01",
					placeOfBirth: "DE",
					legalGender: "Male",
				},
				address: {
					street: "Gneisenaustraße",
					houseNumber: "42",
					zipCode: "10961",
					city: "Berlin",
				},
			},
			updateSection: mockUpdateSection,
			submitProfile: vi.fn().mockResolvedValue({ success: true }),
			isUpdating: false,
			refetch: vi.fn().mockResolvedValue({}),
		});
	});

	it("asserts simultaneous render of all form fields across sections", () => {
		renderWithRouter(<PersonalDataEdit />);

		// Rechtliche Identität fields
		expect(screen.getByTestId("field-firstName-input")).toBeInTheDocument();
		expect(screen.getByTestId("field-lastName-input")).toBeInTheDocument();

		// Staatsangehörigkeit & Status fields
		expect(screen.getByTestId("field-nationality-select")).toBeInTheDocument();
		expect(
			screen.getByTestId("field-maritalStatus-select"),
		).toBeInTheDocument();

		// Meldeadresse fields
		expect(screen.getByTestId("field-street-input")).toBeInTheDocument();
		expect(screen.getByTestId("field-zipCode-input")).toBeInTheDocument();
	});

	it("asserts that standard form fields render with interactive Pencil icons as clear visual affordances", () => {
		const { container } = renderWithRouter(<PersonalDataEdit />);
		expect(container.querySelector(".lucide-pencil")).toBeInTheDocument();
	});

	it("triggers auto-save on field blur when modified", async () => {
		mockUpdateSection.mockResolvedValue({ success: true });
		renderWithRouter(<PersonalDataEdit />);

		const firstNameInput = screen.getByTestId("field-firstName-input");
		fireEvent.change(firstNameInput, { target: { value: "Alexander" } });
		fireEvent.blur(firstNameInput);

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "personalData",
				data: expect.objectContaining({ firstName: "Alexander" }),
			});
		});
	});

	it("shows saving status during background synchronization", async () => {
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: { personalData: { firstName: "Sandor" } },
			updateSection: mockUpdateSection,
			isUpdating: true,
			refetch: vi.fn().mockResolvedValue({}),
		});

		renderWithRouter(<PersonalDataEdit />);
		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(screen.getByText("personal.actions.saving")).toBeInTheDocument();
	});

	it("displays inline validation errors for invalid zipCode length", async () => {
		renderWithRouter(<PersonalDataEdit />);
		const zipCodeInput = screen.getByTestId("field-zipCode-input");

		fireEvent.change(zipCodeInput, { target: { value: "123456789012345" } });
		fireEvent.blur(zipCodeInput);

		await waitFor(() => {
			expect(screen.getByTestId("field-zipCode-error")).toBeInTheDocument();
		});
	});

	it("executes single-click save and close instantly on submit even when all fields are empty", async () => {
		const mockSubmit = vi.fn().mockResolvedValue({ success: true });
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			updateSection: vi.fn(),
			submitProfile: mockSubmit,
			isUpdating: false,
			refetch: vi.fn().mockResolvedValue({}),
		});

		renderWithRouter(<PersonalDataEdit />);
		const doneButton = screen.getByTestId("done-button");
		fireEvent.click(doneButton);

		await waitFor(() => {
			expect(mockSubmit).toHaveBeenCalled();
			expect(mockNavigate).toHaveBeenCalledWith("/profile", { replace: true });
		});
	});

	it("renders primary CTA button disabled when isUpdating is true", () => {
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {},
			updateSection: vi.fn(),
			submitProfile: vi.fn(),
			isUpdating: true,
			refetch: vi.fn().mockResolvedValue({}),
		});

		renderWithRouter(<PersonalDataEdit />);
		const doneButton = screen.getByTestId("done-button");
		expect(doneButton).toBeDisabled();
	});
});
