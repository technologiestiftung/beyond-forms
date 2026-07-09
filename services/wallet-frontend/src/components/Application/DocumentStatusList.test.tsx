import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DocumentStatusList } from "./DocumentStatusList";
import {
	type WalletDocument,
	ProcessingStatusEnum,
} from "../../schemas/profile.schema";

import { Origins } from "../../constants/origin";

// Mock translations
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultText: string) => defaultText,
		i18n: { language: "de" },
	}),
}));

// Mock useProfile hook
vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => ({
		deleteDocument: vi.fn(),
		isDeleting: false,
	}),
}));

describe("DocumentStatusList", () => {
	const mockDocs: WalletDocument[] = [
		{
			id: "doc-1",
			name: "Personalausweis",
			type: "ID_CARD",
			status: ProcessingStatusEnum.enum.PROCESSING,
			uploadDate: new Date().toISOString(),
			confidence: 0.9,
		},
		{
			id: "doc-2",
			name: "Mietvertrag",
			type: "RENTAL_CONTRACT",
			status: ProcessingStatusEnum.enum.VERIFIED,
			uploadDate: new Date().toISOString(),
			confidence: 0.95,
		},
		{
			id: "doc-3",
			name: "Meldebescheinigung",
			type: "OTHER",
			status: ProcessingStatusEnum.enum.COMPLETED,
			uploadDate: new Date().toISOString(),
			confidence: 0.85,
		},
	];

	it("displays required checklist slots for application wizard (WIZARD origin)", () => {
		render(
			<MemoryRouter>
				<DocumentStatusList documents={mockDocs} origin={Origins.WIZARD} />
			</MemoryRouter>,
		);

		// Helmut Klar (MVP) application expected document slots
		expect(screen.getByTestId("slot-title-id_card")).toBeInTheDocument();
		expect(
			screen.getByTestId("slot-title-health_insurance"),
		).toBeInTheDocument();
		expect(screen.getByTestId("slot-title-pension_notice")).toBeInTheDocument();
		expect(screen.getByTestId("slot-title-stmt3")).toBeInTheDocument();
		expect(screen.getByTestId("slot-title-rent")).toBeInTheDocument();
		expect(screen.getByTestId("slot-title-heating")).toBeInTheDocument();

		// Non-targeted slots must NOT be displayed in the wizard
		expect(
			screen.queryByTestId("slot-title-registration"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId("slot-title-utility_bill"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId("slot-title-cooperation_agreement"),
		).not.toBeInTheDocument();
	});

	it("correctly identifies and matches uploaded documents by type to avoid unsorted category", () => {
		const bankDoc: WalletDocument = {
			id: "doc-bank",
			name: "statement.pdf",
			type: "BANK_STATEMENT",
			status: ProcessingStatusEnum.enum.VERIFIED,
			uploadDate: new Date().toISOString(),
			confidence: 0.95,
		};
		render(
			<MemoryRouter>
				<DocumentStatusList documents={[bankDoc]} />
			</MemoryRouter>,
		);
		expect(
			screen.queryByText("Kürzlich hochgeladene Dokumente (Unsortiert)"),
		).not.toBeInTheDocument();
	});

	it("correctly matches PENSION_STATEMENT to pension_notice slot", () => {
		const pensionDoc: WalletDocument = {
			id: "doc-pension",
			name: "pension.pdf",
			type: "PENSION_STATEMENT",
			status: ProcessingStatusEnum.enum.VERIFIED,
			uploadDate: new Date().toISOString(),
			confidence: 0.95,
		};
		render(
			<MemoryRouter>
				<DocumentStatusList documents={[pensionDoc]} />
			</MemoryRouter>,
		);
		expect(
			screen.queryByText("Kürzlich hochgeladene Dokumente (Unsortiert)"),
		).not.toBeInTheDocument();
	});

	it("respects the showDelete prop and hides trash icons when false", () => {
		const sampleDoc: WalletDocument = {
			id: "doc-123",
			name: "identity.pdf",
			type: "ID_CARD",
			status: ProcessingStatusEnum.enum.VERIFIED,
			uploadDate: new Date().toISOString(),
			confidence: 0.95,
		};
		const { rerender } = render(
			<MemoryRouter>
				<DocumentStatusList documents={[sampleDoc]} showDelete={false} />
			</MemoryRouter>,
		);
		expect(screen.queryByTestId("delete-btn-doc-123")).not.toBeInTheDocument();

		rerender(
			<MemoryRouter>
				<DocumentStatusList documents={[sampleDoc]} showDelete={true} />
			</MemoryRouter>,
		);
		expect(screen.getByTestId("delete-btn-doc-123")).toBeInTheDocument();
	});

	it("renders pulsing orange badge 'Verarbeitung...' in triage section for PROCESSING or PENDING documents and uses aria-live", () => {
		const processingDoc: WalletDocument = {
			id: "doc-processing",
			name: "test_statement.pdf",
			type: "OTHER",
			status: ProcessingStatusEnum.enum.PROCESSING,
			uploadDate: new Date().toISOString(),
			confidence: 0,
		};

		render(
			<MemoryRouter>
				<DocumentStatusList
					documents={[processingDoc]}
					showUnassigned={true}
					slotIds={[]}
				/>
			</MemoryRouter>,
		);

		// 1. Should display "Verarbeitung..." badge
		expect(screen.getByText("Verarbeitung...")).toBeInTheDocument();
		// 2. Should NOT display "Prüfen" button
		expect(
			screen.queryByRole("button", { name: /Prüfen/i }),
		).not.toBeInTheDocument();

		// 3. Accessibility check: status indicators must be wrapped in an aria-live polite container
		const container = screen
			.getByText("Verarbeitung...")
			.closest("[aria-live='polite']");
		expect(container).toBeInTheDocument();
	});

	it("keeps only unassigned / unverified files in triage area and hides matched slot files", () => {
		const mockFileList: WalletDocument[] = [
			{
				id: "doc-verified-slot",
				name: "mietvertrag.pdf",
				type: "RENTAL_CONTRACT",
				status: ProcessingStatusEnum.enum.VERIFIED,
				uploadDate: new Date().toISOString(),
				confidence: 0.95,
			},
			{
				id: "doc-processing-slot",
				name: "personalausweis.pdf",
				type: "ID_CARD",
				status: ProcessingStatusEnum.enum.PROCESSING,
				uploadDate: new Date().toISOString(),
				confidence: 0.9,
			},
			{
				id: "doc-completed-other",
				name: "other_doc.pdf",
				type: "OTHER",
				status: ProcessingStatusEnum.enum.COMPLETED,
				uploadDate: new Date().toISOString(),
				confidence: 0.85,
			},
		];

		render(
			<MemoryRouter>
				<DocumentStatusList
					documents={mockFileList}
					showUnassigned={true}
					slotIds={[]}
				/>
			</MemoryRouter>,
		);

		// 1. Should NOT display personalausweis.pdf in triage since it matches a slot (anti-duplication)
		expect(screen.queryByText("personalausweis.pdf")).not.toBeInTheDocument();

		// 2. Should display unassigned unverified file
		expect(screen.getByText("other_doc.pdf")).toBeInTheDocument();

		// 3. Should NOT display verified file
		expect(screen.queryByText("mietvertrag.pdf")).not.toBeInTheDocument();
	});

	it("disables clicking, displays 'Verarbeitung...' inside slot card, and uses aria-live if matched file is PROCESSING", () => {
		const processingSlotDoc: WalletDocument = {
			id: "doc-pension",
			name: "pension_notice.pdf",
			type: "PENSION_STATEMENT",
			status: ProcessingStatusEnum.enum.PROCESSING,
			uploadDate: new Date().toISOString(),
			confidence: 0.9,
		};

		render(
			<MemoryRouter>
				<DocumentStatusList documents={[processingSlotDoc]} />
			</MemoryRouter>,
		);

		// In checklist view, find the pension notice slot card
		const pensionCard = screen
			.getByTestId("slot-title-pension_notice")
			.closest("button");
		expect(pensionCard).toBeInTheDocument();
		expect(pensionCard).toBeDisabled();

		// Verify slot card renders "Verarbeitung..." instead of a Chevron right
		expect(pensionCard).not.toBeNull();
		if (pensionCard) {
			const indicator = within(pensionCard).getByText("Verarbeitung...");
			expect(indicator).toBeInTheDocument();
			// Accessibility check: verify status region is aria-live="polite"
			expect(indicator.closest("[aria-live='polite']")).toBeInTheDocument();
		}
	});
});
