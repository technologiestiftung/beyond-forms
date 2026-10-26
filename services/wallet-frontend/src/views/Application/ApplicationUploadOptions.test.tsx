import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ApplicationUploadOptions } from "./ApplicationUploadOptions";
import { AppRoutes } from "../../constants/routes";
import { useIsDesktop } from "../../hooks/useIsDesktop";

vi.mock("../../hooks/useIsDesktop", () => ({
	useIsDesktop: vi.fn(() => false),
}));

const UploadPage = () => {
	const state = useLocation().state as {
		backgroundLocation?: { pathname: string };
	} | null;
	return (
		<div data-testid="upload-page">
			{state?.backgroundLocation?.pathname ?? "no-background"}
		</div>
	);
};

describe("ApplicationUploadOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useIsDesktop).mockReturnValue(false);
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
						element={<UploadPage />}
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
			screen.getByText("questionnaire.intro.upload_options_title"),
		).toBeInTheDocument();
		expect(
			screen.getByText("questionnaire.intro.upload_options_desc"),
		).toBeInTheDocument();
		expect(screen.getByText("financial.intro.upload_doc")).toBeInTheDocument();
		expect(screen.getByText("financial.intro.take_photo")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "questionnaire.intro.back_to_intro" }),
		).toBeInTheDocument();
	});

	it("navigates back to the intro page on clicking the back button", () => {
		renderComponent();

		const backBtn = screen.getByRole("button", {
			name: "questionnaire.intro.back_to_intro",
		});
		fireEvent.click(backBtn);

		expect(screen.getByTestId("intro-page")).toBeInTheDocument();
	});

	it("navigates to dashboard overview if category is missing or invalid on clicking the back button", () => {
		renderComponent(AppRoutes.ApplicationUploadOptions); // no search params

		const backBtn = screen.getByRole("button", {
			name: "questionnaire.intro.back_to_intro",
		});
		fireEvent.click(backBtn);

		expect(screen.getByTestId("overview-page")).toBeInTheDocument();
	});

	it("navigates to upload page with upload mode parameters when clicking the upload option", () => {
		renderComponent();

		const uploadBtn = screen.getByText("financial.intro.upload_doc");
		fireEvent.click(uploadBtn);

		expect(screen.getByTestId("upload-page")).toBeInTheDocument();
	});

	it("navigates to upload page with camera mode parameters when clicking the camera option", () => {
		renderComponent();

		const cameraBtn = screen.getByText("financial.intro.take_photo");
		fireEvent.click(cameraBtn);

		expect(screen.getByTestId("upload-page")).toBeInTheDocument();
	});

	it("opens the upload as a full page on mobile", () => {
		renderComponent();

		fireEvent.click(screen.getByText("financial.intro.upload_doc"));

		expect(screen.getByTestId("upload-page")).toHaveTextContent(
			"no-background",
		);
	});

	it("opens the upload in the document dialog over the options on desktop", () => {
		vi.mocked(useIsDesktop).mockReturnValue(true);
		renderComponent();

		fireEvent.click(screen.getByText("financial.intro.upload_doc"));

		expect(screen.getByTestId("upload-page")).toHaveTextContent(
			AppRoutes.ApplicationUploadOptions,
		);
	});
});
