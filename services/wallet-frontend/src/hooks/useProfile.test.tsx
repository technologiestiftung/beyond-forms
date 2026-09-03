import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProfile } from "./useProfile";
import { fileService } from "../services/profile/FileService";
import { useProfileStore } from "../store/useProfileStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock services
vi.mock("../services/profile/FileService", () => ({
	fileService: {
		deleteFile: vi.fn(),
		getFiles: vi
			.fn()
			.mockImplementation(async () => useProfileStore.getState().documents),
	},
}));

vi.mock("../services/profile", () => ({
	profileService: {
		getProfile: vi.fn().mockResolvedValue({}),
	},
}));

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useProfile - Deletion & Optimistic Updates", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useProfileStore.getState().reset();
	});

	it("optimistically removes a document and reverts if backend deletion fails", async () => {
		// Arrange
		const initialDocs = [
			{
				id: "doc-1",
				name: "ID.pdf",
				type: "id_card" as const,
				status: "VERIFIED" as const,
				uploadDate: new Date().toISOString(),
			},
		];
		queryClient.setQueryData(["profile"], { profile: {}, files: initialDocs });

		// Mock deleteFile to return a pending promise that we can reject on-demand
		let rejectMutation!: (err: Error) => void;
		const pendingPromise = new Promise<void>((_, reject) => {
			rejectMutation = reject;
		});
		(
			fileService.deleteFile as unknown as ReturnType<typeof vi.fn>
		).mockReturnValue(pendingPromise);

		// Act
		const { result } = renderHook(() => useProfile(), { wrapper });

		let mutationPromise: Promise<void> | undefined;
		act(() => {
			mutationPromise = result.current.deleteDocument("doc-1");
		});

		// Await a microtask tick to allow async onMutate to execute the state update
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Assert optimistic update: the document should be immediately removed from React Query cache
		expect(
			queryClient.getQueryData<{ profile: unknown; files: unknown[] }>([
				"profile",
			])?.files,
		).toEqual([]);

		// Now fail the request to test rollback
		act(() => {
			rejectMutation(new Error("Network Error"));
		});

		// Wait for mutation to reject and check store is rolled back
		await expect(mutationPromise).rejects.toThrow("Network Error");
		expect(
			queryClient.getQueryData<{ profile: unknown; files: unknown[] }>([
				"profile",
			])?.files,
		).toEqual(initialDocs);
	});
});
