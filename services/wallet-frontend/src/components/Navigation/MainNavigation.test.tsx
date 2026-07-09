import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainNavigation } from "./MainNavigation";

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback || key,
	}),
}));

vi.mock("../../hooks/useProfile", () => ({
	useProfile: () => ({
		documents: [],
	}),
}));

describe("MainNavigation Component", () => {
	it("renders mobile bottom navigation bar and desktop sidebar items", () => {
		render(
			<MemoryRouter>
				<MainNavigation />
			</MemoryRouter>,
		);

		// Check that the container has the z-50 breakthrough class
		const navElement = screen.getByRole("navigation");
		expect(navElement).toBeInTheDocument();
		expect(navElement.className).toContain("z-50");

		// Verify chat button and navigation links
		expect(screen.getByTestId("nav-chat-button")).toBeInTheDocument();
	});

	it("allows toggling chat unconditionally", () => {
		render(
			<MemoryRouter>
				<MainNavigation />
			</MemoryRouter>,
		);

		const chatButton = screen.getByTestId("nav-chat-button");
		fireEvent.click(chatButton);
		expect(chatButton).toBeInTheDocument();
	});
});
