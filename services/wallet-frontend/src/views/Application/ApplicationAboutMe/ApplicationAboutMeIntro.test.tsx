import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationAboutMeIntro } from "./ApplicationAboutMeIntro";
import { AppRoutes } from "../../../constants/routes";

import deApplication from "../../../locales/de/application.json";

const translate = (key: string, defaultText?: string) => {
	const value = key
		.split(".")
		.reduce<unknown>(
			(node, part) => (node as Record<string, unknown> | undefined)?.[part],
			deApplication,
		);
	return typeof value === "string" ? value : (defaultText ?? key);
};

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: translate,
		i18n: { language: "de", changeLanguage: vi.fn() },
	}),
}));

describe("ApplicationAboutMeIntro", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderComponent = (
		initialRoute = AppRoutes.ApplicationAboutMeIntro,
	) => {
		return render(
			<MemoryRouter initialEntries={[initialRoute]}>
				<Routes>
					<Route
						path={AppRoutes.ApplicationAboutMeIntro}
						element={<ApplicationAboutMeIntro />}
					/>
					<Route
						path={AppRoutes.ApplicationAboutMeQuestions}
						element={<div data-testid="questions-page">Questions Page</div>}
					/>
					<Route
						path={AppRoutes.ApplicationUploadOptions}
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

	it("renders title, description, and list of recommended documents without important callouts", () => {
		renderComponent();

		expect(screen.getByText("Über Dich")).toBeInTheDocument();
		expect(
			screen.getByText(/Lade Dokumente hoch.*Der Assistent/s),
		).toBeInTheDocument();
		expect(screen.getByText("Personalausweis")).toBeInTheDocument();
		expect(screen.getByText("Reisepass")).toBeInTheDocument();
		expect(screen.getByText("Aufenthaltstitel")).toBeInTheDocument();
		expect(
			screen.getByText("Aufenthaltsgestattung/Duldung"),
		).toBeInTheDocument();
		expect(screen.queryByText("Wichtig zu wissen")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Weiter" }),
		).not.toBeInTheDocument();
	});

	it("navigates to upload options when clicking 'Dokumente hochladen'", () => {
		renderComponent();

		const uploadBtn = screen.getByText("Dokumente hochladen");
		fireEvent.click(uploadBtn);

		expect(screen.getByTestId("upload-page")).toBeInTheDocument();
	});

	it("navigates to the manual questionnaire when clicking 'Angaben manuell ausfüllen'", () => {
		renderComponent();

		const manualBtn = screen.getByText("Angaben manuell ausfüllen");
		fireEvent.click(manualBtn);

		expect(screen.getByTestId("questions-page")).toBeInTheDocument();
	});
});
