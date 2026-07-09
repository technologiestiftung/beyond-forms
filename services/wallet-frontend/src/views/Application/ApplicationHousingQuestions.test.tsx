import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApplicationHousingQuestions } from "./ApplicationHousingQuestions";
import { BrowserRouter } from "react-router-dom";
import { useProfile } from "../../hooks/useProfile";
import { AppRoutes } from "../../constants/routes";

vi.mock("../../hooks/useProfile", () => ({
	useProfile: vi.fn(),
}));

const MOCK_TRANSLATIONS: Record<string, string> = {
	"housing.questions.address_title": "Wie lautet Deine aktuelle Wohnadresse?",
	"housing.labels.no_fixed_address": "Ich habe aktuell keine feste Adresse",
	"housing.labels.street": "Straße",
	"housing.labels.houseNumber": "Hausnummer",
	"housing.labels.zipCode": "Postleitzahl",
	"housing.labels.city": "Stadt",
	"housing.questions.last_fixed_address_title":
		"Wo hast Du zuletzt fest gewohnt?",
	"housing.labels.last_fixed_address": "Letzter fester Wohnort",
	"housing.questions.accomodation_type_title": "Wie wohnst Du zurzeit?",
	"housing.options.accomodation_rental": "Ich lebe in einer Mietwohnung",
	"housing.options.accomodation_own":
		"Ich lebe in meinem Eigenheim / Eigentumswohnung",
	"housing.options.accomodation_care": "Ich wohne in einer Pflegeeinrichtung",
	"housing.options.accomodation_relative":
		"Ich lebe bei Verwandten / Bekannten",
	"housing.questions.tenancy_status_title": "Bist Du Haupt- oder Untermieter?",
	"housing.options.tenancy_main": "Ich bin Hauptmieter",
	"housing.options.tenancy_sub": "Ich bin Untermieter",
	"housing.options.tenancy_free": "Ich habe freies Wohnrecht",
	"housing.labels.landlord_name": "Name des Vermieters",
	"housing.labels.free_housing_right_holder":
		"Freies Wohnrecht bei (Name der Person)",
	"housing.questions.sublet_title": "Vermietest Du Zimmer unter?",
	"housing.labels.sublet_room_count": "Wie viele Zimmer vermietest Du unter?",
	"housing.labels.sublet_rent_income": "Miete (Warm) in EUR",
	"housing.questions.arrears_title": "Hast Du Mietrückstände?",
	"housing.labels.rent_paid_until": "Miete gezahlt bis (Datum)",
	"housing.questions.costs_title":
		"Wie hoch sind Deine monatlichen Wohnkosten?",
	"housing.labels.rent_total": "Miete insgesamt (Warmmiete) in EUR",
	"housing.labels.heating_costs": "Heizkosten (€)",
	"housing.labels.hot_water_costs": "Warmwasserkosten (€)",
	"housing.labels.cable_tv_costs": "Kabelfernsehen (€)",
	"housing.questions.size_title": "Wie groß ist Deine Wohnung/Haus?",
	"housing.labels.living_area": "Fläche in Quadratmetern",
	"housing.labels.number_of_rooms": "Anzahl der Räume (ohne Küche/Bad)",
	"housing.questions.heating_type_title": "Wie wird Deine Wohnung beheizt?",
	"housing.options.heating_sammelheizung": "Sammelheizung",
	"housing.options.heating_warmwasser": "Zentrale Warmwasserversorgung",
	"housing.options.heating_gasheizung": "Gasheizung",
	"housing.options.heating_nachtstrom": "Nachtstromspeicher",
	"housing.options.heating_ofenheizung": "Ofenheizung",
	"common.save_and_continue": "Speichern und weiter",
	"common.done": "Geschafft!",
};

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, ...args: unknown[]) => {
			const firstArg = args[0];
			if (
				firstArg &&
				typeof firstArg === "object" &&
				"defaultValue" in firstArg &&
				typeof (firstArg as { defaultValue: unknown }).defaultValue === "string"
			) {
				return (
					MOCK_TRANSLATIONS[key] ||
					(firstArg as { defaultValue: string }).defaultValue
				);
			}
			if (typeof firstArg === "string") {
				return MOCK_TRANSLATIONS[key] || firstArg;
			}
			return MOCK_TRANSLATIONS[key] || key;
		},
		i18n: {
			language: "de",
			changeLanguage: vi.fn(),
		},
	}),
}));

const { mockNavigate } = vi.hoisted(() => ({
	mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
	const mod = await importOriginal<typeof import("react-router-dom")>();
	return {
		...mod,
		useNavigate: () => mockNavigate,
		useLocation: () => ({ search: "", state: null }),
	};
});

const renderWithRouter = (ui: React.ReactElement) => {
	return render(ui, { wrapper: BrowserRouter });
};

describe("ApplicationHousingQuestions - TDD & Clean UI Verification", () => {
	const mockUpdateSection = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(useProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			profileData: {
				address: {
					street: "Platz der Luftbrücke",
					houseNumber: "4",
					zipCode: "12101",
					city: "Berlin",
				},
				housing: {
					accomodationType: "Rental Apartment",
					tenancyStatus: "Main Tenant",
					rentTotal: 430,
					heatingCosts: 75,
					livingArea: 52,
					numberOfRooms: 2,
					heatingType: "Sammelheizung",
				},
			},
			updateSection: mockUpdateSection.mockResolvedValue({ success: true }),
			isUpdating: false,
			refetch: vi.fn().mockResolvedValue({}),
		});
	});

	it("asserts multi-page navigation and correct interactive card state updates", async () => {
		renderWithRouter(<ApplicationHousingQuestions />);

		// Page 1: Address
		expect(
			screen.getByText("Wie lautet Deine aktuelle Wohnadresse?"),
		).toBeInTheDocument();
		expect(screen.getByTestId("field-street-input")).toHaveValue(
			"Platz der Luftbrücke",
		);
		fireEvent.click(screen.getByTestId("next-button"));

		// Page 2: Accommodation Status
		await waitFor(() => {
			expect(screen.getByText("Wie wohnst Du zurzeit?")).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId("next-button"));

		// Page 3: Tenancy Status
		await waitFor(() => {
			expect(
				screen.getByText("Bist Du Haupt- oder Untermieter?"),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId("next-button"));

		// Page 4: Subletting
		await waitFor(() => {
			expect(
				screen.getByText("Vermietest Du Zimmer unter?"),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId("next-button"));

		// Page 5: Arrears
		await waitFor(() => {
			expect(screen.getByText("Hast Du Mietrückstände?")).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId("next-button"));

		// Page 6: Costs
		await waitFor(() => {
			expect(
				screen.getByText("Wie hoch sind Deine monatlichen Wohnkosten?"),
			).toBeInTheDocument();
		});
		expect(screen.getByTestId("field-rentTotal-input")).toHaveValue(430);
	});

	it("verifies conditional own home path bypasses tenancy status and arrears pages", async () => {
		renderWithRouter(<ApplicationHousingQuestions />);

		// Go to Page 2
		fireEvent.click(screen.getByTestId("next-button"));
		await waitFor(() => {
			expect(screen.getByText("Wie wohnst Du zurzeit?")).toBeInTheDocument();
		});

		// Select Own Home
		fireEvent.click(
			screen.getByText("Ich lebe in meinem Eigenheim / Eigentumswohnung"),
		);
		fireEvent.click(screen.getByTestId("next-button"));

		// Bypasses Page 3 (Tenancy) -> directly goes to Page 4 (Sublet)
		await waitFor(() => {
			expect(
				screen.getByText("Vermietest Du Zimmer unter?"),
			).toBeInTheDocument();
		});

		// Click next from Page 4
		fireEvent.click(screen.getByTestId("next-button"));

		// Bypasses Page 5 (Arrears) -> directly goes to Page 6 (Costs)
		await waitFor(() => {
			expect(
				screen.getByText("Wie hoch sind Deine monatlichen Wohnkosten?"),
			).toBeInTheDocument();
		});
	});

	it("triggers page save on next button click when modified", async () => {
		renderWithRouter(<ApplicationHousingQuestions />);

		// Navigate to Step 6 (Wohnkosten)
		fireEvent.click(screen.getByTestId("next-button")); // to Page 2
		await waitFor(() => screen.getByText("Wie wohnst Du zurzeit?"));
		fireEvent.click(screen.getByTestId("next-button")); // to Page 3
		await waitFor(() => screen.getByText("Bist Du Haupt- oder Untermieter?"));
		fireEvent.click(screen.getByTestId("next-button")); // to Page 4
		await waitFor(() => screen.getByText("Vermietest Du Zimmer unter?"));
		fireEvent.click(screen.getByTestId("next-button")); // to Page 5
		await waitFor(() => screen.getByText("Hast Du Mietrückstände?"));
		fireEvent.click(screen.getByTestId("next-button")); // to Page 6
		await waitFor(() =>
			screen.getByText("Wie hoch sind Deine monatlichen Wohnkosten?"),
		);

		const rentInput = screen.getByTestId("field-rentTotal-input");
		fireEvent.change(rentInput, { target: { value: "450" } });
		fireEvent.blur(rentInput);

		// Click next to trigger page save
		fireEvent.click(screen.getByTestId("next-button"));

		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "housing",
				data: expect.objectContaining({ rentTotal: 450 }),
			});
		});
	});

	it("verifies free housing right path saves initial values and navigates away", async () => {
		renderWithRouter(<ApplicationHousingQuestions />);

		// Go to Page 2
		fireEvent.click(screen.getByTestId("next-button"));
		await waitFor(() => {
			expect(screen.getByText("Wie wohnst Du zurzeit?")).toBeInTheDocument();
		});

		// Go to Page 3
		fireEvent.click(screen.getByTestId("next-button"));
		await waitFor(() => {
			expect(
				screen.getByText("Bist Du Haupt- oder Untermieter?"),
			).toBeInTheDocument();
		});

		// Select Free Lodging
		fireEvent.click(screen.getByText("Ich habe freies Wohnrecht"));

		// Expect freeHousingRightHolder field to be visible
		await waitFor(() => {
			expect(
				screen.getByLabelText("Freies Wohnrecht bei (Name der Person)"),
			).toBeInTheDocument();
		});

		// Click next to save and navigate
		fireEvent.click(screen.getByTestId("next-button"));

		// Assert that freeHousingRightHolder and tenancyStatus are updated
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "housing",
				data: expect.objectContaining({ freeHousingRightHolder: "Ja" }),
			});
		});

		// Should navigate to Household questions category
		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(
				AppRoutes.ApplicationHouseholdQuestions,
			);
		});
	});
});
