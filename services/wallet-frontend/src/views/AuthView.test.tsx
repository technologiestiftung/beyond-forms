import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	render,
	screen,
	fireEvent,
	act,
	waitFor,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthView } from "./AuthView";
import { useAuthStore } from "../store/useAuthStore";
import { AppRoutes } from "../constants/routes";

vi.mock("framer-motion", async () => {
	const actual = await vi.importActual("framer-motion");
	return {
		...actual,
		AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
		motion: {
			div: ({
				children,
				className,
				"data-testid": testId,
			}: {
				children: React.ReactNode;
				className: string;
				"data-testid": string;
			}) => (
				<div className={className} data-testid={testId}>
					{children}
				</div>
			),
			p: ({
				children,
				className,
				"data-testid": testId,
			}: {
				children: React.ReactNode;
				className: string;
				"data-testid": string;
			}) => (
				<p className={className} data-testid={testId}>
					{children}
				</p>
			),
		},
	};
});

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			key === "benefit_verified_sub" && params?.phone
				? (params.phone as string)
				: key,
		i18n: { language: "de", changeLanguage: vi.fn() },
	}),
}));

describe("AuthView & Auth Flow", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		useAuthStore.getState().logout();
		vi.useFakeTimers();
	});

	const renderComponent = (initialEntries = ["/auth"]) => {
		const TestComponent = () => {
			return (
				<Routes>
					<Route path="/auth" element={<AuthView />} />
					<Route
						path={AppRoutes.Dashboard}
						element={
							<div data-testid="post-registration-dashboard">Dashboard</div>
						}
					/>
				</Routes>
			);
		};

		return render(
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={initialEntries}>
					<TestComponent />
				</MemoryRouter>
			</QueryClientProvider>,
		);
	};

	it("Task 1: should stay on the RegistrationSuccess view and navigate to Dashboard when clicking Next CTA button", async () => {
		useAuthStore.setState({
			status: "SUCCESS_NEW",
			phoneNumber: "+49 151 98765432",
		});
		renderComponent();

		expect(screen.getByTestId("registration-success")).toBeInTheDocument();
		expect(screen.getByText("+49 151 98765432")).toBeInTheDocument();

		expect(
			screen.queryByTestId("post-registration-dashboard"),
		).not.toBeInTheDocument();

		const nextButton = screen.getByTestId("registration-success-next-button");
		expect(nextButton).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(nextButton);
		});

		expect(
			screen.getByTestId("post-registration-dashboard"),
		).toBeInTheDocument();
	});

	it("Task 2: should render a back button on OTP verification view that returns to phone number entry", async () => {
		useAuthStore.setState({
			status: "AWAITING_OTP",
			phoneNumber: "+4917612345678",
		});
		renderComponent();

		expect(screen.getByTestId("otp-form")).toBeInTheDocument();

		const backButton = screen.getByTestId("topbar-back");
		expect(backButton).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(backButton);
		});

		await act(async () => {
			vi.advanceTimersByTime(1000);
		});

		vi.useRealTimers();

		await waitFor(
			() => {
				expect(useAuthStore.getState().status).toBe("IDLE");
				expect(screen.getByTestId("phone-number-form")).toBeInTheDocument();
			},
			{ timeout: 3000 },
		);
	});
});
