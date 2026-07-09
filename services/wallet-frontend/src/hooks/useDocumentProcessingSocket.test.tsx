import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentProcessingSocket } from "./useDocumentProcessingSocket";
import { useAuthStore } from "../store/useAuthStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
vi.mock("../store/useAuthStore", () => ({
	useAuthStore: vi.fn(),
}));

import { BrowserRouter } from "react-router-dom";

const queryClient = new QueryClient();
const wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider client={queryClient}>
		<BrowserRouter>{children}</BrowserRouter>
	</QueryClientProvider>
);

describe("useDocumentProcessingSocket", () => {
	let mockWebSocket: {
		send: unknown;
		close: unknown;
		readyState: number;
		onopen: unknown;
		onmessage: unknown;
		onclose: unknown;
		onerror: unknown;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockWebSocket = {
			send: vi.fn(),
			close: vi.fn(),
			readyState: 1, // OPEN
			onopen: null,
			onmessage: null,
			onclose: null,
			onerror: null,
		};

		// Mock WebSocket using traditional function to ensure it's a constructor
		function MockWebSocket() {
			return mockWebSocket;
		}
		MockWebSocket.prototype = {};

		// @ts-expect-error - Mocking global WebSocket
		window.WebSocket = vi.fn().mockImplementation(function () {
			return new (MockWebSocket as unknown as typeof WebSocket)(
				"ws://localhost",
			);
		});
		(useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
			"mock-token",
		);
	});

	afterEach(() => {
		// @ts-expect-error - Cleaning up mock
		delete window.WebSocket;
	});

	it("initializes WebSocket connection when token is present", () => {
		renderHook(() => useDocumentProcessingSocket(), { wrapper });
		expect(window.WebSocket).toHaveBeenCalled();
	});

	it("does not initialize WebSocket when token is missing", () => {
		(useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
		renderHook(() => useDocumentProcessingSocket(), { wrapper });
		expect(window.WebSocket).not.toHaveBeenCalled();
	});

	it("invalidates queries when DOCUMENT_PROCESSED event is received", async () => {
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		renderHook(() => useDocumentProcessingSocket(), { wrapper });

		// Simulate receiving a message
		const onMessage = mockWebSocket.onmessage as (event: {
			data: string;
		}) => void;
		onMessage({ data: JSON.stringify({ type: "DOCUMENT_PROCESSED" }) });

		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profile"] });
	});

	it("closes WebSocket on unmount", () => {
		const { unmount } = renderHook(() => useDocumentProcessingSocket(), {
			wrapper,
		});
		unmount();
		expect(mockWebSocket.close).toHaveBeenCalled();
	});
});
