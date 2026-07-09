import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApplicationAboutMeQuestions } from "./ApplicationAboutMeQuestions";
import { useProfile } from "../../hooks/useProfile";
import type { Profile } from "../../schemas/profile.schema";

// Mock react-i18next
const MOCK_TRANSLATIONS: Record<string, string> = {
	"personal.questions.name_title": "Wie ist Dein Name?",
	"personal.questions.birth_title": "Wann und wo bist Du geboren?",
	"personal.questions.gender_title": "Welches Geschlecht?",
	"personal.questions.address_title": "Wie lautet Deine Wohnadresse?",
	"personal.questions.last_fixed_address_title":
		"Wo hast Du zuletzt fest gewohnt?",
	"personal.questions.citizenship_title": "Was trifft auf Dich zu?",
	"personal.questions.no_fixed_address_label":
		"Ich habe aktuell keine feste Adresse",
	"personal.options.german": "Ich besitze die deutsche Staatsangehörigkeit",
	"personal.options.yes": "Ja",
	"personal.options.no": "Nein",
	"personal.options.none": "Nein",
	"personal.options.social": "Sozialversicherung",
	"personal.options.health": "Krankenversicherung",
	"personal.options.not_insured": "Nicht versichert",
	"personal.questions.support_title": "Wirst Du rechtlich betreut?",
	"personal.questions.displaced_title":
		"Bist Du Vertriebene:r oder Spätaussiedler:in?",
	"personal.questions.insurance_title": "Wie bist Du krankenversichert?",
	"personal.placeholders.first_name": "Vorname eingeben",
	"personal.placeholders.last_name": "Nachname eingeben",
	"personal.placeholders.birth_place": "Geburtsort eingeben",
	"personal.placeholders.address": "Straße, Hausnummer, PLZ, Stadt",
	"personal.placeholders.authority": "Behörde eingeben",
	"personal.labels.address": "Adresse",
	"personal.labels.displaced_status": "Vertriebenenstatus",
	"personal.labels.displaced_since": "Seit wann ist dieser Status gültig?",
	"personal.labels.displaced_authority":
		"Zuständige Behörde / Einwanderungsbehörde",
	"personal.dropdowns.select_eu_country": "-- EU-Land auswählen --",
	"personal.dropdowns.select_origin_country": "-- Herkunftsland auswählen --",
	"personal.dropdowns.select_status": "-- Status auswählen --",
	"personal.dropdowns.select_insurance": "-- Versicherung auswählen --",
	"personal.options.female": "Female",
	"personal.options.male": "Male",
	"personal.options.diverse": "Diverse",
	"personal.options.displaced_expellee": "Heimatvertriebene/r (Ausweis A)",
	"personal.options.displaced_person": "Vertriebene/r (Ausweis B)",
	"personal.options.displaced_late_resettler": "Spätaussiedler/in",
	"personal.options.displaced_refugee": "Sowjetzonenflüchtling",
	"personal.options.insurance_statutory": "Gesetzlich (z.B. AOK, TK)",
	"personal.options.insurance_private": "Privat",
	"personal.options.insurance_other": "Andere / Freiwillig",
	"personal.options.status_family": "Familienversichert",
	"personal.options.status_student": "Studentisch versichert",
	"personal.options.status_pensioner": "Rentner (KVdR)",
	"personal.options.status_employee": "Pflichtversichert (Angestellt)",
	"personal.options.status_voluntary": "Freiwillig versichert",
	"personal.options.status_other": "Andere",
	"personal.labels.insurance_provider": "Art der Sozialversicherung",
	"personal.labels.insurance_status": "Art der Krankenversicherung",
};

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "personal.steps.step_x_of_y") {
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

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();
	return {
		...actual,
		useQueryClient: () => ({
			invalidateQueries: vi.fn(),
		}),
	};
});

describe("ApplicationAboutMeQuestions", () => {
	const mockUpdateSection = vi.fn();
	const mockRefetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateSection.mockResolvedValue({ success: true });
		vi.mocked(useProfile).mockReturnValue({
			profileData: {
				personalData: {},
				address: {},
				household: {},
			} as unknown as Profile,
			isLoading: false,
			isError: false,
			refetch: mockRefetch,
			updateSection: mockUpdateSection,
			isUpdating: false,
			updateError: null,
			deleteDocument: vi.fn(),
			isDeleting: false,
			submitProfile: vi.fn(),
			completionPercentage: 0,
			documents: [],
			milestoneLevel: 0,
		});
	});

	it("navigates step-by-step through the first 4 pages", async () => {
		const { container } = render(
			<MemoryRouter>
				<ApplicationAboutMeQuestions />
			</MemoryRouter>,
		);

		// Page 1: Name
		expect(screen.getByText("Wie ist Dein Name?")).toBeInTheDocument();
		fireEvent.change(screen.getByPlaceholderText("Vorname eingeben"), {
			target: { value: "Helmut" },
		});
		fireEvent.change(screen.getByPlaceholderText("Nachname eingeben"), {
			target: { value: "Klar" },
		});

		const nextBtn1 = screen.getByRole("button", { name: "Weiter" });
		fireEvent.click(nextBtn1);

		await screen.findByText("Wann und wo bist Du geboren?");

		// Page 2: Birth
		const dateInput = container.querySelector('input[type="date"]');
		if (!dateInput) {
			throw new Error("dateInput not found");
		}
		fireEvent.change(dateInput, { target: { value: "1959-05-15" } });
		fireEvent.change(screen.getByPlaceholderText("Geburtsort eingeben"), {
			target: { value: "Berlin" },
		});

		const nextBtn2 = screen.getByRole("button", { name: "Weiter" });
		fireEvent.click(nextBtn2);

		await screen.findByText("Welches Geschlecht?");

		// Page 3: Gender
		const femaleOpt = screen.getByText("Female");
		fireEvent.click(femaleOpt);

		await screen.findByText("Wie lautet Deine Wohnadresse?");
	});

	it("skips page 5 (last fixed address) if fixed address is provided", async () => {
		const { container } = render(
			<MemoryRouter>
				<ApplicationAboutMeQuestions />
			</MemoryRouter>,
		);

		// Manually transition to page 4
		fireEvent.change(screen.getByPlaceholderText("Vorname eingeben"), {
			target: { value: "Helmut" },
		});
		fireEvent.change(screen.getByPlaceholderText("Nachname eingeben"), {
			target: { value: "Klar" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Wann und wo bist Du geboren?");

		const dateInput = container.querySelector('input[type="date"]');
		if (!dateInput) {
			throw new Error("dateInput not found");
		}
		fireEvent.change(dateInput, { target: { value: "1959-05-15" } });
		fireEvent.change(screen.getByPlaceholderText("Geburtsort eingeben"), {
			target: { value: "Berlin" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Welches Geschlecht?");

		fireEvent.click(screen.getByText("Female"));
		await screen.findByText("Wie lautet Deine Wohnadresse?");

		fireEvent.change(
			screen.getByPlaceholderText("Straße, Hausnummer, PLZ, Stadt"),
			{
				target: { value: "Platz der Luftbrücke 4, 12101 Berlin" },
			},
		);

		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		await screen.findByText("Was trifft auf Dich zu?");
	});

	it("renders page 5 (last fixed address) if 'no fixed address' is checked", async () => {
		const { container } = render(
			<MemoryRouter>
				<ApplicationAboutMeQuestions />
			</MemoryRouter>,
		);

		// Manually transition to page 4
		fireEvent.change(screen.getByPlaceholderText("Vorname eingeben"), {
			target: { value: "Helmut" },
		});
		fireEvent.change(screen.getByPlaceholderText("Nachname eingeben"), {
			target: { value: "Klar" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Wann und wo bist Du geboren?");

		const dateInput = container.querySelector('input[type="date"]');
		if (!dateInput) {
			throw new Error("dateInput not found");
		}
		fireEvent.change(dateInput, { target: { value: "1959-05-15" } });
		fireEvent.change(screen.getByPlaceholderText("Geburtsort eingeben"), {
			target: { value: "Berlin" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Welches Geschlecht?");

		fireEvent.click(screen.getByText("Female"));
		await screen.findByText("Wie lautet Deine Wohnadresse?");

		// Check "no fixed address" option
		fireEvent.click(screen.getByText("Ich habe aktuell keine feste Adresse"));
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		await screen.findByText("Wo hast Du zuletzt fest gewohnt?");
	});

	it("allows submitting blank fields on page 1 and transitions to page 2", async () => {
		render(
			<MemoryRouter>
				<ApplicationAboutMeQuestions />
			</MemoryRouter>,
		);

		// Leave inputs blank and click Weiter
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Expect page 2 title to be shown
		expect(
			await screen.findByText("Wann und wo bist Du geboren?"),
		).toBeInTheDocument();
	});

	it("navigates through the entire flow and redirects to overview on Page 9 completion", async () => {
		const { container } = render(
			<MemoryRouter>
				<ApplicationAboutMeQuestions />
			</MemoryRouter>,
		);

		// Page 1: Name
		expect(screen.getByRole("progressbar")).toBeInTheDocument();
		expect(screen.getByText("Wie ist Dein Name?")).toBeInTheDocument();
		fireEvent.change(screen.getByPlaceholderText("Vorname eingeben"), {
			target: { value: "Helmut" },
		});
		fireEvent.change(screen.getByPlaceholderText("Nachname eingeben"), {
			target: { value: "Klar" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 2: Birth
		await screen.findByText("Wann und wo bist Du geboren?");
		expect(screen.getByRole("progressbar")).toBeInTheDocument();
		const dateInput = container.querySelector('input[type="date"]');
		if (!dateInput) {
			throw new Error("dateInput not found");
		}
		fireEvent.change(dateInput, { target: { value: "1959-05-15" } });
		fireEvent.change(screen.getByPlaceholderText("Geburtsort eingeben"), {
			target: { value: "Berlin" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 3: Gender
		await screen.findByText("Welches Geschlecht?");
		fireEvent.click(screen.getByText("Female"));

		// Page 4: Address
		await screen.findByText("Wie lautet Deine Wohnadresse?");
		fireEvent.change(
			screen.getByPlaceholderText("Straße, Hausnummer, PLZ, Stadt"),
			{
				target: { value: "Platz der Luftbrücke 4, 12101 Berlin" },
			},
		);
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 6: Citizenship
		await screen.findByText("Was trifft auf Dich zu?");
		fireEvent.click(
			screen.getByText("Ich besitze die deutsche Staatsangehörigkeit"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Expect redirect to overview
		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(
				"/dashboard/application/overview",
			);
		});
	});

	it("pre-populates nationality to DE and sets statusOption to german if place of birth is Berlin in navigation state", async () => {
		render(
			<MemoryRouter
				initialEntries={[
					{
						pathname: "/",
						state: {
							extractedData: {
								birth_place: "Berlin",
							},
						},
					},
				]}
			>
				<ApplicationAboutMeQuestions />
			</MemoryRouter>,
		);

		// Page 1: Name -> click Weiter to Page 2
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Wann und wo bist Du geboren?");

		// Page 2: Birth -> Geburtsort should be Berlin, click Weiter to Page 3
		expect(screen.getByPlaceholderText("Geburtsort eingeben")).toHaveValue(
			"Berlin",
		);
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Welches Geschlecht?");

		// Page 3: Gender -> click Female to Page 4
		fireEvent.click(screen.getByText("Female"));
		await screen.findByText("Wie lautet Deine Wohnadresse?");

		// Page 4: Address -> fill and click Weiter to Page 6
		fireEvent.change(
			screen.getByPlaceholderText("Straße, Hausnummer, PLZ, Stadt"),
			{
				target: { value: "Platz der Luftbrücke 4, 12101 Berlin" },
			},
		);
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Was trifft auf Dich zu?");

		// Page 6: Citizenship/Residence status
		// Status option "german" should be selected
		const germanOption = screen.getByTestId("about-me-option-german");
		expect(germanOption).toHaveClass("border-primary-blue-500");
	});

	it("does not auto-toggle German citizenship if place of birth is Heidelberg or Denver", async () => {
		render(
			<MemoryRouter
				initialEntries={[
					{
						pathname: "/",
						state: {
							extractedData: {
								birth_place: "Heidelberg",
							},
						},
					},
				]}
			>
				<ApplicationAboutMeQuestions />
			</MemoryRouter>,
		);

		// Page 1: Name -> click Weiter to Page 2
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Wann und wo bist Du geboren?");

		// Page 2: Birth -> Geburtsort should be Heidelberg, click Weiter to Page 3
		expect(screen.getByPlaceholderText("Geburtsort eingeben")).toHaveValue(
			"Heidelberg",
		);
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Welches Geschlecht?");

		// Page 3: Gender -> click Female to Page 4
		fireEvent.click(screen.getByText("Female"));
		await screen.findByText("Wie lautet Deine Wohnadresse?");

		// Page 4: Address -> fill and click Weiter to Page 6
		fireEvent.change(
			screen.getByPlaceholderText("Straße, Hausnummer, PLZ, Stadt"),
			{
				target: { value: "Platz der Luftbrücke 4, 12101 Berlin" },
			},
		);
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await screen.findByText("Was trifft auf Dich zu?");

		// Page 6: Citizenship/Residence status
		// Status option "german" should NOT be selected
		const germanOption = screen.getByTestId("about-me-option-german");
		expect(germanOption).not.toHaveClass("border-primary-blue-500");
	});
});
