import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTutorialStore } from "./useTutorialStore";

// Mock client API definitions
const mockGetMyTutorials = vi.fn();
const mockUpdateTutorialProgress = vi.fn();

vi.mock("../services/cms", () => ({
	cmsService: {
		getMyTutorials: () => mockGetMyTutorials(),
		updateTutorialProgress: (payload: unknown) =>
			mockUpdateTutorialProgress(payload),
	},
}));

describe("useTutorialStore (TDD Phase)", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		// Reset the store to its initial layout
		useTutorialStore.setState({
			tutorials: [],
			isLoading: false,
			initialized: false,
			error: null,
		});
	});

	it("should successfully pull tutorials and map loading flags", async () => {
		const mockData = [
			{
				id: "uuid-1",
				slug: "welcome-intro",
				title: { de: "Willkommen", en: "Welcome" },
				subtitle: {
					de: "Hier findest Du die wichtigsten Infos.",
					en: "Here you'll find the key information.",
				},
				progress: { status: "not_started", current_step: null },
				steps: [
					{
						step_id: "page-1",
						content: {
							de: { title: "Hi", text: "Hallo" },
							en: { title: "Hi", text: "Hello" },
						},
					},
				],
			},
		];
		mockGetMyTutorials.mockResolvedValueOnce(mockData);

		const fetchPromise = useTutorialStore.getState().fetchTutorials();
		expect(useTutorialStore.getState().isLoading).toBe(true);

		await fetchPromise;
		expect(useTutorialStore.getState().isLoading).toBe(false);
		expect(useTutorialStore.getState().tutorials).toHaveLength(1);
		expect(useTutorialStore.getState().tutorials[0].slug).toBe("welcome-intro");
	});

	it("should optimistically complete tutorial status locally and execute update request", async () => {
		useTutorialStore.setState({
			tutorials: [
				{
					id: "uuid-1",
					slug: "welcome-intro",
					title: { de: "Willkommen", en: "Welcome" },
					subtitle: {
						de: "Hier findest Du die wichtigsten Infos.",
						en: "Here you'll find the key information.",
					},
					progress: { status: "not_started", current_step: null },
					steps: [],
				},
			],
		});

		mockUpdateTutorialProgress.mockResolvedValueOnce({ status: "success" });

		await useTutorialStore.getState().completeTutorial("uuid-1");

		// Assert optimistic local update took effect immediately
		expect(useTutorialStore.getState().tutorials[0].progress.status).toBe(
			"completed",
		);
		expect(mockUpdateTutorialProgress).toHaveBeenCalledWith({
			tutorial_id: "uuid-1",
			status: "completed",
		});
	});

	it("should return true for onboarding completion selector if all tutorials are finished", () => {
		useTutorialStore.setState({
			tutorials: [
				{
					id: "uuid-1",
					slug: "welcome-intro",
					title: { de: "Willkommen", en: "Welcome" },
					subtitle: {
						de: "Hier findest Du die wichtigsten Infos.",
						en: "Here you'll find the key information.",
					},
					progress: { status: "completed", current_step: null },
					steps: [],
				},
				{
					id: "uuid-2",
					slug: "wie-funktioniert-die-applikation",
					title: { de: "Anleitung", en: "Guide" },
					subtitle: {
						de: "Hier findest Du die wichtigsten Infos.",
						en: "Here you'll find the key information.",
					},
					progress: { status: "completed", current_step: null },
					steps: [],
				},
			],
		});

		const isComplete = useTutorialStore.getState().areAllTutorialsCompleted();
		expect(isComplete).toBe(true);
	});

	it("should return false for onboarding completion selector if any tutorial is in_progress or not_started", () => {
		useTutorialStore.setState({
			tutorials: [
				{
					id: "uuid-1",
					slug: "welcome-intro",
					title: { de: "Willkommen", en: "Welcome" },
					subtitle: {
						de: "Hier findest Du die wichtigsten Infos.",
						en: "Here you'll find the key information.",
					},
					progress: { status: "in_progress", current_step: "page-2" },
					steps: [],
				},
				{
					id: "uuid-2",
					slug: "wie-funktioniert-die-applikation",
					title: { de: "Anleitung", en: "Guide" },
					subtitle: {
						de: "Hier findest Du die wichtigsten Infos.",
						en: "Here you'll find the key information.",
					},
					progress: { status: "in_progress", current_step: "page-2" },
					steps: [],
				},
			],
		});

		const isComplete = useTutorialStore.getState().areAllTutorialsCompleted();
		expect(isComplete).toBe(false);
	});

	it("should shift initialized flag to true on fetch success or failure", async () => {
		// 1. Success path
		mockGetMyTutorials.mockResolvedValueOnce([]);
		expect(useTutorialStore.getState().initialized).toBe(false);
		await useTutorialStore.getState().fetchTutorials();
		expect(useTutorialStore.getState().initialized).toBe(true);

		// Reset
		useTutorialStore.setState({ initialized: false });

		// 2. Failure path
		mockGetMyTutorials.mockRejectedValueOnce(new Error("API Error"));
		expect(useTutorialStore.getState().initialized).toBe(false);
		await useTutorialStore.getState().fetchTutorials();
		expect(useTutorialStore.getState().initialized).toBe(true);
	});

	it("should fall back to STATIC_FALLBACK_TUTORIALS when API returns empty lists or throws", async () => {
		mockGetMyTutorials.mockResolvedValueOnce([]);
		await useTutorialStore.getState().fetchTutorials();
		expect(useTutorialStore.getState().tutorials).toHaveLength(2);
		expect(useTutorialStore.getState().tutorials[1].slug).toBe(
			"wie-funktioniert-die-applikation",
		);

		// Reset
		useTutorialStore.setState({ tutorials: [], initialized: false });

		mockGetMyTutorials.mockRejectedValueOnce(new Error("Network Offline"));
		await useTutorialStore.getState().fetchTutorials();
		expect(useTutorialStore.getState().tutorials).toHaveLength(2);
		expect(useTutorialStore.getState().tutorials[1].slug).toBe(
			"wie-funktioniert-die-applikation",
		);
	});

	it("should keep local completed state even if backend sync fails (offline-first resilience)", async () => {
		useTutorialStore.setState({
			tutorials: [
				{
					id: "uuid-1",
					slug: "wie-funktioniert-die-applikation",
					title: { de: "Willkommen", en: "Welcome" },
					subtitle: { de: "Subtitle", en: "Subtitle" },
					progress: { status: "not_started", current_step: null },
					steps: [],
				},
			],
		});

		mockUpdateTutorialProgress.mockRejectedValueOnce(
			new Error("Database synchronization lag / 404"),
		);

		await useTutorialStore.getState().completeTutorial("uuid-1");

		// Local state MUST still be completed even if backend throws
		expect(useTutorialStore.getState().tutorials[0].progress.status).toBe(
			"completed",
		);
	});

	it("should not overwrite locally completed tutorial status if subsequent fetchTutorials returns stale not_started server data", async () => {
		// 1. Initialize store with uncompleted mandatory guide
		useTutorialStore.setState({
			tutorials: [
				{
					id: "uuid-app-guide",
					slug: "wie-funktioniert-die-applikation",
					title: { de: "Guide", en: "Guide" },
					subtitle: { de: "Sub", en: "Sub" },
					progress: { status: "not_started", current_step: null },
					steps: [],
				},
			],
			initialized: true,
		});

		// 2. Citizen finishes tutorial optimistically
		await useTutorialStore.getState().completeTutorial("uuid-app-guide");
		expect(useTutorialStore.getState().tutorials[0].progress.status).toBe(
			"completed",
		);

		// 3. Simulate DashboardView calling fetchTutorials() returning stale server state
		mockGetMyTutorials.mockResolvedValueOnce([
			{
				id: "uuid-app-guide",
				slug: "wie-funktioniert-die-applikation",
				title: { de: "Guide", en: "Guide" },
				subtitle: { de: "Sub", en: "Sub" },
				progress: { status: "not_started", current_step: null },
				steps: [],
			},
		]);

		await useTutorialStore.getState().fetchTutorials(true);

		// 4. Verification: Optimistic completion status MUST be preserved
		expect(useTutorialStore.getState().tutorials[0].progress.status).toBe(
			"completed",
		);
	});
});
