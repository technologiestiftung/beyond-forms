import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PersonaPicker } from "./PersonaPicker";
import { useAuthStore } from "../../store/useAuthStore";
import { getMockProfileStorageKey } from "../../utils/profile";
import { DEMO_PERSONAS } from "../../config/demoPersonas";

const { mockEnv } = vi.hoisted(() => ({
	mockEnv: { VITE_USE_MOCK_AUTH: true, VITE_USE_MOCKS: false },
}));

vi.mock("../../config/env.config", () => ({ env: mockEnv }));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
	}),
}));

describe("PersonaPicker", () => {
	beforeEach(() => {
		localStorage.clear();
		mockEnv.VITE_USE_MOCK_AUTH = true;
		// Reset synchronously (not the async `logout()` action) so a delayed
		// mock-provider response from a previous test can't land mid-test.
		useAuthStore.setState({
			status: "IDLE",
			phoneNumber: null,
			token: null,
			error: null,
			errorCode: null,
		});
	});

	it("renders a card for every demo persona plus a create-new-profile option", () => {
		render(<PersonaPicker onUsePhoneNumber={vi.fn()} />);

		for (const persona of DEMO_PERSONAS) {
			expect(
				screen.getByTestId(`persona-card-${persona.slug}`),
			).toBeInTheDocument();
		}
		expect(screen.getByTestId("persona-card-create-new")).toBeInTheDocument();
	});

	it("logs in instantly as a persona, seeding its demo profile in mock mode", async () => {
		render(<PersonaPicker onUsePhoneNumber={vi.fn()} />);

		fireEvent.click(screen.getByTestId("persona-card-helmut"));

		await waitFor(() => {
			expect(useAuthStore.getState().status).toBe("SUCCESS_RETURNING");
		});
		expect(useAuthStore.getState().phoneNumber).toBe("+493023125102");

		const stored = localStorage.getItem(
			getMockProfileStorageKey("+493023125102"),
		);
		expect(stored).toBeTruthy();
		expect(JSON.parse(stored as string).personalData.firstName).toBe("Helmut");
	});

	it("creates a fresh, non-reserved drama number for a new profile without seeding a profile", async () => {
		render(<PersonaPicker onUsePhoneNumber={vi.fn()} />);

		fireEvent.click(screen.getByTestId("persona-card-create-new"));

		await waitFor(() => {
			expect(useAuthStore.getState().status).toBe("SUCCESS_NEW");
		});

		const phoneNumber = useAuthStore.getState().phoneNumber as string;
		expect(phoneNumber).not.toMatch(/^\+493023125/);
		expect(localStorage.getItem(getMockProfileStorageKey(phoneNumber))).toBeNull();
	});

	it("reveals the phone-number flow via the fallback link", () => {
		const onUsePhoneNumber = vi.fn();
		render(<PersonaPicker onUsePhoneNumber={onUsePhoneNumber} />);

		fireEvent.click(screen.getByTestId("use-phone-instead-link"));

		expect(onUsePhoneNumber).toHaveBeenCalled();
	});
});
