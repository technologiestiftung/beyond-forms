import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DownloadSuccessModal, WELFARE_OFFICES } from "./DownloadSuccessModal";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultText: string) => {
			if (key === "overview.success_modal.hours_label") {
				return "Öffnungszeiten:";
			}
			return defaultText;
		},
	}),
}));

describe("DownloadSuccessModal", () => {
	it("renders nothing when closed", () => {
		const { container } = render(
			<DownloadSuccessModal isOpen={false} onClose={vi.fn()} district={null} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders details and default fallback text when open with no district", () => {
		const onClose = vi.fn();
		render(
			<DownloadSuccessModal isOpen={true} onClose={onClose} district={null} />,
		);

		expect(screen.getByText("PDF heruntergeladen!")).toBeDefined();
		expect(
			screen.getByText(
				"Dein Antrag liegt auf Deinem Gerät bereit zum Ausdrucken.",
			),
		).toBeDefined();
		expect(screen.getByText("Zuständiges Sozialamt")).toBeDefined();
		expect(
			screen.getByText("Zuständiges Sozialamt online suchen"),
		).toBeDefined();

		const ctaButton = screen.getByRole("button", {
			name: /Zurück zu Antrag auf Grundsicherung/i,
		});
		expect(ctaButton).toBeDefined();
		fireEvent.click(ctaButton);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("renders specific office details when a valid district is provided", () => {
		const onClose = vi.fn();
		render(
			<DownloadSuccessModal
				isOpen={true}
				onClose={onClose}
				district="Tempelhof-Schöneberg"
			/>,
		);

		const office = WELFARE_OFFICES["Tempelhof-Schöneberg"];
		expect(screen.getByText(office.name)).toBeDefined();
		expect(screen.getByText(office.street)).toBeDefined();
		expect(screen.getByText(office.zipCity)).toBeDefined();
		expect(screen.getByText("Öffnungszeiten:")).toBeDefined();

		office.hours.forEach((hour) => {
			expect(screen.getByText(hour)).toBeDefined();
		});
	});

	it("triggers onClose when close button is clicked", () => {
		const onClose = vi.fn();
		render(
			<DownloadSuccessModal isOpen={true} onClose={onClose} district={null} />,
		);

		const closeBtn = screen.getByLabelText("Schließen");
		fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("triggers onClose when Escape key is pressed", () => {
		const onClose = vi.fn();
		render(
			<DownloadSuccessModal isOpen={true} onClose={onClose} district={null} />,
		);

		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
