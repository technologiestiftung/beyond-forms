import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApplicationHouseholdQuestions } from "./ApplicationHouseholdQuestions";
import { useProfile } from "../../hooks/useProfile";
import type { Profile } from "../../schemas/profile.schema";

// Mock react-i18next
const MOCK_TRANSLATIONS: Record<string, string> = {
	"personal.questions.support_title": "Wirst Du rechtlich betreut?",
	"personal.questions.displaced_title":
		"Bist Du Vertriebene:r oder Spätaussiedler:in?",
	"personal.questions.insurance_title": "Wie bist Du krankenversichert?",
	"personal.options.custodian": "Ja, durch eine:n rechtliche:n Betreuer:in",
	"personal.options.guardian": "Ja, durch eine Vormundschaft",
	"personal.options.none": "Nein",
	"personal.options.yes": "Ja",
	"personal.options.no": "Nein",
	"personal.options.social": "Sozialversicherung",
	"personal.options.health": "Krankenversicherung",
	"personal.options.not_insured": "Nicht versichert",
	"personal.labels.displaced_status": "Vertriebenenstatus",
	"personal.labels.displaced_since": "Seit wann ist dieser Status gültig?",
	"personal.labels.displaced_authority":
		"Zuständige Behörde / Einwanderungsbehörde",
	"personal.placeholders.authority": "Behörde eingeben",
	"personal.dropdowns.select_status": "-- Status auswählen --",
	"personal.dropdowns.select_insurance": "-- Versicherung auswählen --",
	"personal.labels.insurance_provider": "Art der Sozialversicherung",
	"personal.labels.insurance_status": "Art der Krankenversicherung",
	"personal.options.displaced_expellee": "Heimatvertriebene/r (Ausweis A)",
	"personal.options.displaced_person": "Vertriebene/r (Ausweis B)",
	"personal.options.displaced_late_resettler": "Spätaussiedler/in",
	"personal.options.displaced_refugee": "Sowjetzonenflüchtling",
	"personal.options.insurance_statutory": "Gesetzlich (z.B. AOK, TK)",
	"personal.options.insurance_private": "Privat",
	"personal.options.insurance_other": "Andere / Freiwillig",
	"household.questions.members_title":
		"Wie viele Personen leben in Deinem Haushalt?",
	"household.questions.marital_status_title":
		"Wie ist Dein aktueller Familienstand?",
	"household.options.single": "Ledig / Alleinstehend",
	"household.options.married": "Verheiratet / Eingetragene Lebenspartnerschaft",
	"household.options.divorced": "Geschieden",
	"household.options.widowed": "Verwitwet",
	"household.labels.married_since": "Seit wann?",
	"household.questions.married_since_label": "Seit wann?",
	"household.actions.finish": "Speichern & Beenden",
};

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "household.steps.step_x_of_y") {
				return `Step ${options?.current} of ${options?.total}`;
			}
			if (key === "common:next") {
				return "Weiter";
			}
			if (key === "common:save_next") {
				return "Speichern & Weiter";
			}
			return MOCK_TRANSLATIONS[key] || key;
		},
		i18n: { language: "de", changeLanguage: vi.fn() },
	}),
}));

vi.mock("../../hooks/useProfile", () => ({
	useProfile: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router-dom")>();
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

describe("ApplicationHouseholdQuestions", () => {
	const mockUpdateSection = vi.fn();
	const mockRefetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {
				personalData: {},
				household: {},
			} as Profile,
			updateSection: mockUpdateSection.mockResolvedValue({ success: true }),
			refetch: mockRefetch,
			isUpdating: false,
			isLoading: false,
			documents: [],
		});
	});

	it("steps through all 5 sequential household questionnaire pages, updates database, and redirects to overview", async () => {
		render(
			<MemoryRouter>
				<ApplicationHouseholdQuestions />
			</MemoryRouter>,
		);

		// Page 1: Legal Support
		await screen.findByText("Wirst Du rechtlich betreut?");
		expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Nein"));
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenLastCalledWith({
				section: "personalData",
				data: {
					hasCustodian: false,
					hasGuardian: false,
					validateEntireForm: false,
				},
			});
		});

		// Page 2: Displaced status
		await screen.findByText("Bist Du Vertriebene:r oder Spätaussiedler:in?");
		expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Nein"));
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenLastCalledWith({
				section: "personalData",
				data: {
					displacedStatus: "none",
					displacedIssuedOn: null,
					displacedIssuedBy: null,
					validateEntireForm: false,
				},
			});
		});

		// Page 3: Insurance
		await screen.findByText("Wie bist Du krankenversichert?");
		expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();

		// Check multiple choice toggle interactions
		const socialCheck = screen.getByText("Sozialversicherung");
		const healthCheck = screen.getByText("Krankenversicherung");
		const noneCheck = screen.getByText("Nicht versichert");

		// Click Social -> check dropdown is rendered
		fireEvent.click(socialCheck);
		await screen.findByText("Art der Sozialversicherung");

		// Select option from dropdown
		fireEvent.change(screen.getByRole("combobox", { name: "" }), {
			target: { value: "Pension Insurance" },
		});

		// Click Health -> check both sub-selects are rendered
		fireEvent.click(healthCheck);
		await screen.findByText("Art der Krankenversicherung");

		// Click None -> check mutual exclusivity (dropdowns are hidden)
		fireEvent.click(noneCheck);
		expect(
			screen.queryByText("Art der Sozialversicherung"),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Speichern & Weiter" }));

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenLastCalledWith({
				section: "personalData",
				data: {
					socialSecurityType: "None",
					healthInsuranceStatus: null,
					validateEntireForm: false,
				},
			});
		});

		// Page 4: Household Members Count
		await screen.findByText("Wie viele Personen leben in Deinem Haushalt?");
		expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();

		// Change value of spinbutton to 2
		const countInput = screen.getByRole("spinbutton");
		fireEvent.change(countInput, { target: { value: "2" } });

		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenLastCalledWith({
				section: "household",
				data: {
					personsInHouseholdCount: 2,
					validateEntireForm: false,
				},
			});
		});

		// Page 5: Marital Status
		await screen.findByText("Wie ist Dein aktueller Familienstand?");
		expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();

		fireEvent.click(screen.getByText("Ledig / Alleinstehend"));
		fireEvent.click(
			screen.getByRole("button", { name: "Speichern & Beenden" }),
		);

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenLastCalledWith({
				section: "household",
				data: {
					maritalStatus: "Single",
					marriedSince: null,
					validateEntireForm: false,
				},
			});
		});

		// Expect redirect to overview
		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(
				"/dashboard/application/overview",
			);
		});
	});

	it("renders date picker dynamically if Married option is selected on page 5", async () => {
		render(
			<MemoryRouter>
				<ApplicationHouseholdQuestions />
			</MemoryRouter>,
		);

		// Page 1: Legal Support
		await screen.findByText("Wirst Du rechtlich betreut?");
		fireEvent.click(screen.getByText("Nein"));
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 2: Displaced status
		await screen.findByText("Bist Du Vertriebene:r oder Spätaussiedler:in?");
		fireEvent.click(screen.getByText("Nein"));
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 3: Insurance
		await screen.findByText("Wie bist Du krankenversichert?");
		fireEvent.click(screen.getByText("Nicht versichert"));
		fireEvent.click(screen.getByRole("button", { name: "Speichern & Weiter" }));

		// Page 4: Household Members Count
		await screen.findByText("Wie viele Personen leben in Deinem Haushalt?");
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 5: Marital Status
		await screen.findByText("Wie ist Dein aktueller Familienstand?");
		expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();

		// Married selection
		const marriedOption = screen.getByText(
			"Verheiratet / Eingetragene Lebenspartnerschaft",
		);
		fireEvent.click(marriedOption);

		// Expect date picker label to be rendered
		const dateLabel = await screen.findByText("Seit wann?");
		expect(dateLabel).toBeInTheDocument();

		// Set date value
		const dateInput = screen.getByLabelText("Seit wann?");
		fireEvent.change(dateInput, { target: { value: "2020-05-15" } });

		fireEvent.click(
			screen.getByRole("button", { name: "Speichern & Beenden" }),
		);

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenLastCalledWith({
				section: "household",
				data: {
					maritalStatus: "Married",
					marriedSince: "2020-05-15",
					validateEntireForm: false,
				},
			});
		});
	});
});
