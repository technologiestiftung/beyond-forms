import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ProfileHub } from "./ProfileHub";
import { useProfile } from "../../hooks/useProfile";
import { REQUIRED_DOCUMENT_SLOTS } from "../../config/applicationConfig";

vi.mock("../../hooks/useProfile", () => ({
	useProfile: vi.fn(),
}));

const mockUseProfile = useProfile as unknown as ReturnType<typeof vi.fn>;

const renderHub = () => render(<ProfileHub />, { wrapper: BrowserRouter });

describe("ProfileHub", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("stays partial when only the wizard-relevant slots are covered", () => {
		// The documents page lists every required slot, so covering the smaller
		// wizard set must not read as "Vollständig" here.
		const wizardSlotIds = [
			"id_card",
			"health_insurance",
			"pension_notice",
			"stmt3",
			"rent",
			"heating",
		];

		mockUseProfile.mockReturnValue({
			profileData: {},
			documents: REQUIRED_DOCUMENT_SLOTS.filter((slot) =>
				wizardSlotIds.includes(slot.id),
			).map((slot, index) => ({
				id: `doc-${index}`,
				name: slot.defaultTitle,
				type: slot.id,
				status: "VERIFIED",
				uploadDate: new Date().toISOString(),
			})),
		});

		renderHub();

		expect(wizardSlotIds.length).toBeLessThan(REQUIRED_DOCUMENT_SLOTS.length);
		expect(screen.getByTestId("section-documents")).toHaveTextContent(
			"status.partial",
		);
	});

	it("reports the documents section as complete only when every slot is covered", () => {
		mockUseProfile.mockReturnValue({
			profileData: {},
			documents: REQUIRED_DOCUMENT_SLOTS.map((slot, index) => ({
				id: `doc-${index}`,
				name: slot.defaultTitle,
				type: slot.id,
				status: "VERIFIED",
				uploadDate: new Date().toISOString(),
			})),
		});

		renderHub();

		expect(screen.getByTestId("section-documents")).toHaveTextContent(
			"status.complete",
		);
	});
});
