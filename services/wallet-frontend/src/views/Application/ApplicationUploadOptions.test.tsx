import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationUploadOptions } from "./ApplicationUploadOptions";
import { AppRoutes } from "../../constants/routes";

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, defaultText: string) => defaultText,
		i18n: { language: "de", changeLanguage: vi.fn() },
	}),
}));

describe("ApplicationUploadOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderComponent = (
		initialRoute = `${AppRoutes.ApplicationUploadOptions}?category=about_me&origin=wizard`,
	) => {
		return render(
			<MemoryRouter initialEntries={[initialRoute]}>
				<Routes>
					<Route
						path={AppRoutes.ApplicationUploadOptions}
						element={<ApplicationUploadOptions />}
					/>
					<Route
						path={AppRoutes.ApplicationAboutMeIntro}
						element={<div data-testid="intro-page">Intro Page</div>}
					/>
					<Route
						path={AppRoutes.ProfilePersonalDataUpload}
						element={<div data-testid="upload-page">Upload Page</div>}
					/>
					<Route
						path={AppRoutes.ApplicationOverview}
						element={<div data-testid="overview-page">Overview Page</div>}
					/>
				</Routes>
			</MemoryRouter>,
		);
	};

	it("renders title, description, and back button", () => {
		renderComponent();

		expect(
			screen.getByText("Wie möchtest Du Dokumente einreichen?"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Wähle eine Option, um Deine Dokumente hochzuladen."),
		).toBeInTheDocument();
		expect(screen.getByText("Dokument hochladen")).toBeInTheDocument();
		expect(screen.getByText("Mit Kamera aufnehmen")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /zurück/i })).toBeInTheDocument();
	});

	it("navigates back to the intro page on clicking the back button", () => {
		renderComponent();

		const backBtn = screen.getByRole("button", { name: /zurück/i });
		fireEvent.click(backBtn);

		expect(screen.getByTestId("intro-page")).toBeInTheDocument();
	});

	it("navigates to dashboard overview if category is missing or invalid on clicking the back button", () => {
		renderComponent(AppRoutes.ApplicationUploadOptions); // no search params

		const backBtn = screen.getByRole("button", { name: /zurück/i });
		fireEvent.click(backBtn);

		expect(screen.getByTestId("overview-page")).toBeInTheDocument();
	});

	it("navigates to upload page with upload mode parameters when clicking 'Dokument hochladen'", () => {
		renderComponent();

		const uploadBtn = screen.getByText("Dokument hochladen");
		fireEvent.click(uploadBtn);

		expect(screen.getByTestId("upload-page")).toBeInTheDocument();
	});

	it("navigates to upload page with camera mode parameters when clicking 'Mit Kamera aufnehmen'", () => {
		renderComponent();

		const cameraBtn = screen.getByText("Mit Kamera aufnehmen");
		fireEvent.click(cameraBtn);

		expect(screen.getByTestId("upload-page")).toBeInTheDocument();
	});
});
