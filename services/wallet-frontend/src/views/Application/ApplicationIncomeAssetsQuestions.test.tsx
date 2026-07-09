import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApplicationIncomeAssetsQuestions } from "./ApplicationIncomeAssetsQuestions";
import { useProfile } from "../../hooks/useProfile";
import type { Profile } from "../../schemas/profile.schema";

// Mock translation labels
const MOCK_TRANSLATIONS: Record<string, string> = {
	"financial.questions.awaiting_benefits_title":
		"Wartest Du im Moment auf eine Bewilligung für eine Sozialhilfeleistung?",
	"financial.questions.awaiting_benefits_type_label":
		"Um welche Leistung handelt es sich?",
	"financial.questions.awaiting_benefits_date_label": "Antragsdatum",
	"financial.questions.awaiting_benefits_office_label":
		"Welches Amt entscheidet?",
	"financial.questions.awaiting_benefits_office_placeholder":
		"z.B. Sozialamt Tempelhof",
	"financial.questions.awaiting_benefits_ref_label": "Aktenzeichen",
	"financial.questions.awaiting_benefits_ref_placeholder": "z.B. 12/345/67",
	"financial.questions.previous_benefits_title":
		"Hast Du in den letzten zwei Jahren Sozialleistungen erhalten?",
	"financial.questions.previous_benefits_type_label": "Welche Leistung?",
	"financial.questions.previous_benefits_type_placeholder": "z.B. Wohngeld",
	"financial.questions.previous_benefits_office_label": "Welche Stelle?",
	"financial.questions.previous_benefits_office_placeholder":
		"z.B. Wohnungsamt Berlin",
	"financial.questions.previous_benefits_ref_label": "Aktenzeichen",
	"financial.questions.previous_benefits_ref_placeholder": "z.B. Az. 9876-A",
	"financial.questions.pension_title": "Beziehst Du eine Rente?",
	"financial.questions.pension_amount_label":
		"Monatlicher Rentenbetrag (netto in Euro)",
	"financial.questions.pension_amount_placeholder": "z.B. 650.00",
	"financial.questions.employment_title": "Wie ist Deine Erwerbssituation?",
	"financial.questions.employment_amount_label":
		"Monatlicher Verdienst (netto in Euro)",
	"financial.questions.employment_amount_placeholder": "z.B. 450.00",
	"financial.questions.other_income_title":
		"Hast Du weitere regelmäßige Einnahmen?",
	"financial.questions.other_income_amount_label":
		"Monatlicher Betrag (netto in Euro)",
	"financial.questions.other_income_amount_placeholder": "z.B. 100.00",
	"financial.questions.one_time_payment_title":
		"Erwartest Du eine größere einmalige Zahlung?",
	"financial.questions.one_time_payment_type_label": "Art der Zahlung",
	"financial.questions.one_time_payment_type_placeholder":
		"z.B. Steuerrückerstattung",
	"financial.questions.one_time_payment_amount_label": "Erwarteter Betrag",
	"financial.questions.one_time_payment_amount_placeholder": "z.B. 1200.00",
	"financial.questions.one_time_payment_date_label": "Wann?",
	"financial.questions.bank_title": "Wie lautet Deine Bankverbindung?",
	"financial.questions.bank_holder_label": "Kontoinhaber:in",
	"financial.questions.bank_holder_placeholder": "Helmut Klar",
	"financial.questions.bank_name_label": "Bank Name",
	"financial.questions.bank_name_placeholder": "z.B. Sparkasse",
	"financial.questions.bank_iban_label": "IBAN",
	"financial.questions.bank_iban_placeholder": "z.B. DE89 3704 0044 ...",
	"financial.questions.bank_bic_label": "BIC",
	"financial.questions.bank_bic_placeholder": "z.B. WELADED1BER",
	"financial.options.yes": "Ja",
	"financial.options.no": "Nein",
	"financial.options.pension_retirement": "Altersrente (gesetzlich)",
	"financial.options.pension_none": "Nein, ich erhalte keine Rente",
	"financial.options.emp_unemployed": "Arbeitslos",
	"financial.options.other_none": "Nein, keine weiteren Einkünfte",
	"financial.intro.continue": "Weiter",
	"financial.questions.submit_cta": "Zurück zum Antrag",
	"financial.errors.pension_amount_invalid": "Ungültiger Rentenbetrag",
	"financial.errors.employment_amount_invalid": "Ungültiger Verdienstbetrag",
	"financial.errors.other_income_amount_invalid": "Ungültiger Einnahmenbetrag",
	"financial.options.pension_reduced": "Erwerbsminderungsrente",
	"financial.options.pension_survivor": "Hinterbliebenen- / Witwenrente",
	"financial.options.none_of_these": "Nein, ich erhalte keine Rente",
	"financial.questions.amount_net_hint": "Monatlicher Netto-Betrag",
	"financial.questions.account_holder_label": "Kontoinhaber:in",
	"financial.questions.account_holder_placeholder": "Helmut Klar",
	"financial.questions.iban_label": "IBAN",
	"financial.questions.iban_placeholder": "z.B. DE89 3704 0044 ...",
	"financial.questions.bic_label": "BIC",
	"financial.questions.bic_placeholder": "z.B. WELADED1BER",
	"financial.options.emp_employed":
		"Angestellt (Vollzeit / Teilzeit / Minijob / Werkstudierende)",
	"financial.options.emp_self": "Selbstständig / Gewerbe",
	"financial.options.emp_student": "Ausbildung / Studium",
	"financial.options.emp_none": "Nichts davon",
	"financial.questions.employer_label": "Name des Arbeitgebers",
	"financial.questions.job_title_label": "Berufsbezeichnung",
	"financial.options.other_sick": "Krankengeld",
	"financial.options.other_alimony": "Unterhalt",
	"financial.options.other_rent":
		"Sonstige Einnahmen (z.B. Zinsen, Untermiete)",
};

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "financial.steps.step_x_of_y") {
				return `Schritt ${options?.current} von ${options?.total}`;
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

describe("ApplicationIncomeAssetsQuestions", () => {
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
				financial: {},
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

	it("steps through all 7 sequential questionnaire wizard pages, updates database sections, and redirects to overview", async () => {
		render(
			<MemoryRouter>
				<ApplicationIncomeAssetsQuestions />
			</MemoryRouter>,
		);

		// --- Page 1: Awaiting benefits ---
		expect(
			screen.getByText(
				"Wartest Du im Moment auf eine Bewilligung für eine Sozialhilfeleistung?",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 1 von 7")).toBeInTheDocument();

		// Choose "Ja"
		fireEvent.click(screen.getByRole("button", { name: "Ja" }));
		// Fill in inputs
		const officeInput = await screen.findByPlaceholderText(
			"z.B. Sozialamt Tempelhof",
		);
		fireEvent.change(officeInput, { target: { value: "Sozialamt Tempelhof" } });
		fireEvent.change(screen.getByPlaceholderText("z.B. 12/345/67"), {
			target: { value: "REF123" },
		});

		// Click Weiter
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					hasAppliedForBenefitsAwaitingDecision: true,
					benefitsAwaitingDecisionType: "",
					benefitsAwaitingDecisionApplicationDate: null,
					benefitsAwaitingDecisionOffice: "Sozialamt Tempelhof",
					benefitsAwaitingDecisionReference: "REF123",
					validateEntireForm: false,
				},
			});
		});

		// --- Page 2: Previous benefits ---
		expect(
			await screen.findByText(
				"Hast Du in den letzten zwei Jahren Sozialleistungen erhalten?",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 2 von 7")).toBeInTheDocument();

		// Choose "Ja"
		fireEvent.click(screen.getByRole("button", { name: "Ja" }));
		const prevType = await screen.findByPlaceholderText("z.B. Wohngeld");
		fireEvent.change(prevType, { target: { value: "Wohngeld" } });
		fireEvent.change(screen.getByPlaceholderText("z.B. Wohnungsamt Berlin"), {
			target: { value: "Wohnungsamt Berlin" },
		});
		fireEvent.change(screen.getByPlaceholderText("z.B. Az. 9876-A"), {
			target: { value: "Az. 9876-A" },
		});

		// Click Weiter
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "personalData",
				data: {
					hasReceivedPreviousBenefits: true,
					previousBenefitsPeriod: "Wohngeld",
					previousBenefitsAuthority: "Wohnungsamt Berlin",
					previousBenefitsRefNo: "Az. 9876-A",
					validateEntireForm: false,
				},
			});
		});

		// --- Page 3: Pension Status ---
		expect(
			await screen.findByText("Beziehst Du eine Rente?"),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 3 von 7")).toBeInTheDocument();

		// Check Altersrente
		fireEvent.click(screen.getByText("Altersrente (gesetzlich)"));
		// Fill pension amount
		const pensionAmt = await screen.findByPlaceholderText("z.B. 650.00");
		fireEvent.change(pensionAmt, { target: { value: "650" } });

		// Click Weiter
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					incomeSources: ["pension", "pension_retirement"],
					validateEntireForm: false,
				},
			});
		});

		// --- Page 4: Employment ---
		expect(
			await screen.findByText("Wie ist Deine Erwerbssituation?"),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 4 von 7")).toBeInTheDocument();

		// Click "Arbeitslos"
		fireEvent.click(screen.getByText("Arbeitslos"));

		// Click Weiter
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "personalData",
				data: {
					isCurrentlyEmployed: false,
					validateEntireForm: false,
				},
			});
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					incomeSources: [
						"pension",
						"pension_retirement",
						"employment_unemployed",
					],
					validateEntireForm: false,
				},
			});
		});

		// --- Page 5: Other regular monthly income ---
		expect(
			await screen.findByText("Hast Du weitere regelmäßige Einnahmen?"),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 5 von 7")).toBeInTheDocument();

		// Choose "Nein, keine weiteren Einkünfte"
		fireEvent.click(screen.getByText("Nein, keine weiteren Einkünfte"));

		// Click Weiter
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					incomeSources: [
						"pension",
						"pension_retirement",
						"employment_unemployed",
						"none_other",
					],
					validateEntireForm: false,
				},
			});
		});

		// --- Page 6: Expected one-time payments ---
		expect(
			await screen.findByText("Erwartest Du eine größere einmalige Zahlung?"),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 6 von 7")).toBeInTheDocument();

		// Choose "Nein"
		fireEvent.click(screen.getByRole("button", { name: "Nein" }));

		// Click Weiter
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					areOneTimePaymentsExpected: false,
					oneTimePaymentsExpectedType: null,
					oneTimePaymentsExpectedAmount: null,
					oneTimePaymentsExpectedDate: null,
					validateEntireForm: false,
				},
			});
		});

		// --- Page 7: Bank Details ---
		expect(
			await screen.findByText("Wie lautet Deine Bankverbindung?"),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 7 von 7")).toBeInTheDocument();

		// Fill in bank details
		fireEvent.change(screen.getByPlaceholderText("Helmut Klar"), {
			target: { value: "Helmut Klar" },
		});
		fireEvent.change(screen.getByPlaceholderText("z.B. Sparkasse"), {
			target: { value: "Sparkasse" },
		});
		fireEvent.change(screen.getByPlaceholderText("z.B. DE89 3704 0044 ..."), {
			target: { value: "DE89370400441234567890" },
		});
		fireEvent.change(screen.getByPlaceholderText("z.B. WELADED1BER"), {
			target: { value: "WELADED1BER" },
		});

		// Click Zurück zum Antrag (sum of pension 650 + employment 0 + other 0 = 650)
		fireEvent.click(screen.getByRole("button", { name: "Zurück zum Antrag" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					bankDetails: {
						accountHolder: "Helmut Klar",
						bankName: "Sparkasse",
						iban: "DE89370400441234567890",
						bic: "WELADED1BER",
					},
					monthlyIncome: 650,
					validateEntireForm: false,
				},
			});
		});

		// Redirects to overview
		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(
				"/dashboard/application/overview",
			);
		});
	});

	it("should dynamically route to next page based on rules evaluation next_step", async () => {
		mockUpdateSection.mockResolvedValue({
			success: true,
			data: {
				wizard_evaluation: {
					next_step: "step_applicant_expected_payments",
				},
			},
		});

		render(
			<MemoryRouter>
				<ApplicationIncomeAssetsQuestions />
			</MemoryRouter>,
		);

		// Page 1: Awaiting benefits
		expect(
			await screen.findByText(
				"Wartest Du im Moment auf eine Bewilligung für eine Sozialhilfeleistung?",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 1 von 7")).toBeInTheDocument();

		// Click Nein
		fireEvent.click(screen.getByRole("button", { name: "Nein" }));

		// Click Weiter (which calls savePage1 and receives the mocked next_step mapping to Page 6!)
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Assert it skipped to Page 6!
		expect(
			await screen.findByText("Erwartest Du eine größere einmalige Zahlung?"),
		).toBeInTheDocument();
		expect(screen.getByText("Schritt 6 von 7")).toBeInTheDocument();
	});

	it("allows submitting empty pages without validation errors to verify fields are optional", async () => {
		render(
			<MemoryRouter>
				<ApplicationIncomeAssetsQuestions />
			</MemoryRouter>,
		);

		// --- Page 1: Awaiting benefits ---
		expect(
			screen.getByText(
				"Wartest Du im Moment auf eine Bewilligung für eine Sozialhilfeleistung?",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					hasAppliedForBenefitsAwaitingDecision: null,
					benefitsAwaitingDecisionType: null,
					benefitsAwaitingDecisionApplicationDate: null,
					benefitsAwaitingDecisionOffice: null,
					benefitsAwaitingDecisionReference: null,
					validateEntireForm: false,
				},
			});
		});

		// --- Page 2: Previous benefits ---
		expect(
			await screen.findByText(
				"Hast Du in den letzten zwei Jahren Sozialleistungen erhalten?",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "personalData",
				data: {
					hasReceivedPreviousBenefits: null,
					previousBenefitsPeriod: null,
					previousBenefitsAuthority: null,
					previousBenefitsRefNo: null,
					validateEntireForm: false,
				},
			});
		});

		// --- Page 3: Pension Status ---
		expect(
			await screen.findByText("Beziehst Du eine Rente?"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByText("Nein, ich erhalte keine Rente"));
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					incomeSources: ["none_pension"],
					validateEntireForm: false,
				},
			});
		});

		// --- Page 4: Employment ---
		expect(
			await screen.findByText("Wie ist Deine Erwerbssituation?"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByText("Nichts davon"));
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "personalData",
				data: {
					isCurrentlyEmployed: false,
					validateEntireForm: false,
				},
			});
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					incomeSources: ["none_pension", "employment_none"],
					validateEntireForm: false,
				},
			});
		});

		// --- Page 5: Other regular monthly income ---
		expect(
			await screen.findByText("Hast Du weitere regelmäßige Einnahmen?"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					incomeSources: ["none_pension", "employment_none"],
					validateEntireForm: false,
				},
			});
		});

		// --- Page 6: Expected one-time payments ---
		expect(
			await screen.findByText("Erwartest Du eine größere einmalige Zahlung?"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					areOneTimePaymentsExpected: null,
					oneTimePaymentsExpectedType: null,
					oneTimePaymentsExpectedAmount: null,
					oneTimePaymentsExpectedDate: null,
					validateEntireForm: false,
				},
			});
		});

		// --- Page 7: Bank Details ---
		expect(
			await screen.findByText("Wie lautet Deine Bankverbindung?"),
		).toBeInTheDocument();
		fireEvent.change(screen.getByPlaceholderText("Helmut Klar"), {
			target: { value: "Helmut Klar" },
		});
		fireEvent.change(screen.getByPlaceholderText("z.B. Sparkasse"), {
			target: { value: "Sparkasse" },
		});
		fireEvent.change(screen.getByPlaceholderText("z.B. DE89 3704 0044 ..."), {
			target: { value: "DE89370400441234567890" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Zurück zum Antrag" }));
		await waitFor(() => {
			expect(mockUpdateSection).toHaveBeenCalledWith({
				section: "financial",
				data: {
					bankDetails: {
						accountHolder: "Helmut Klar",
						bankName: "Sparkasse",
						iban: "DE89370400441234567890",
						bic: null,
					},
					monthlyIncome: 0,
					validateEntireForm: false,
				},
			});
		});

		// Redirects to overview
		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(
				"/dashboard/application/overview",
			);
		});
	});

	it("shows inline validation errors if invalid numeric amounts are entered on pages 3, 4, and 5", async () => {
		render(
			<MemoryRouter>
				<ApplicationIncomeAssetsQuestions />
			</MemoryRouter>,
		);

		// Go to Page 3 (skip 1 and 2)
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		expect(
			await screen.findByText(
				"Hast Du in den letzten zwei Jahren Sozialleistungen erhalten?",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 3: Pension
		expect(
			await screen.findByText("Beziehst Du eine Rente?"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByText("Altersrente (gesetzlich)"));
		const pensionAmt = await screen.findByPlaceholderText("z.B. 650.00");
		fireEvent.change(pensionAmt, { target: { value: "1.2.3" } });
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Assert pension invalid amount error is displayed
		expect(
			await screen.findByText("Ungültiger Rentenbetrag"),
		).toBeInTheDocument();

		// Change to valid number and proceed
		fireEvent.change(pensionAmt, { target: { value: "650" } });
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 4: Employment
		expect(
			await screen.findByText("Wie ist Deine Erwerbssituation?"),
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByText(
				"Angestellt (Vollzeit / Teilzeit / Minijob / Werkstudierende)",
			),
		);
		const employmentAmt = await screen.findByPlaceholderText("z.B. 450.00");
		fireEvent.change(employmentAmt, { target: { value: "1.2.3" } });
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Assert employment invalid amount error is displayed
		expect(
			await screen.findByText("Ungültiger Verdienstbetrag"),
		).toBeInTheDocument();

		// Change to empty string (which is valid and optional) and proceed
		fireEvent.change(employmentAmt, { target: { value: "" } });
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 5: Other income
		expect(
			await screen.findByText("Hast Du weitere regelmäßige Einnahmen?"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByText("Krankengeld"));
		const otherAmt = await screen.findByPlaceholderText("z.B. 100.00");
		fireEvent.change(otherAmt, { target: { value: "invalid_num" } });
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Assert other income invalid amount error is displayed
		expect(
			await screen.findByText("Ungültiger Einnahmenbetrag"),
		).toBeInTheDocument();
	});

	it("initializes checkboxes and amount correctly if profile contains qualitative E-Checker pension strings", async () => {
		vi.mocked(useProfile).mockReturnValue({
			profileData: {
				personalData: {},
				address: {},
				household: {},
				financial: {
					incomeSources: ["Altersrente", "Erwerbsminderungsrente"],
					monthlyIncome: 650.0,
				},
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

		render(
			<MemoryRouter>
				<ApplicationIncomeAssetsQuestions />
			</MemoryRouter>,
		);

		// Page 1: Click "Weiter"
		expect(
			screen.getByText(
				"Wartest Du im Moment auf eine Bewilligung für eine Sozialhilfeleistung?",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 2: Click "Weiter"
		expect(
			await screen.findByText(
				"Hast Du in den letzten zwei Jahren Sozialleistungen erhalten?",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Page 3: Assert Page 3 is rendered
		expect(
			await screen.findByText("Beziehst Du eine Rente?"),
		).toBeInTheDocument();

		// Altersrente (gesetzlich) card should be selected (has border-primary-blue-500 class)
		const altersrenteCard = screen.getByTestId("option-card-altersrente");
		expect(altersrenteCard).toHaveClass("border-primary-blue-500");

		// Erwerbsminderungsrente card should be selected (has border-primary-blue-500 class)
		const reducedCard = screen.getByTestId(
			"option-card-erwerbsminderungsrente",
		);
		expect(reducedCard).toHaveClass("border-primary-blue-500");

		// Pension amount input should be pre-populated with 650
		const pensionAmt = screen.getByPlaceholderText(
			"z.B. 650.00",
		) as HTMLInputElement;
		expect(pensionAmt.value).toBe("650");
	});

	it("correctly handles German comma decimal input values without failing validation", async () => {
		render(
			<MemoryRouter>
				<ApplicationIncomeAssetsQuestions />
			</MemoryRouter>,
		);

		// Page 1 -> Page 2 -> Page 3
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		expect(
			await screen.findByText(
				"Hast Du in den letzten zwei Jahren Sozialleistungen erhalten?",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
		expect(
			await screen.findByText("Beziehst Du eine Rente?"),
		).toBeInTheDocument();

		// Check pension checkbox
		fireEvent.click(screen.getByText("Altersrente (gesetzlich)"));

		// Input pension with comma
		const pensionAmt = await screen.findByPlaceholderText("z.B. 650.00");
		fireEvent.change(pensionAmt, { target: { value: "650,50" } });

		// Click Weiter (should not fail or display invalid amount error)
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		// Verify we are on Page 4 (Employment)
		expect(
			await screen.findByText("Wie ist Deine Erwerbssituation?"),
		).toBeInTheDocument();
	});
});
