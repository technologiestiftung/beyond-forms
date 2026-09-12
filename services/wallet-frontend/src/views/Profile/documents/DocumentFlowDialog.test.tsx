import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, type Location } from "react-router-dom";
import { DocumentFlowDialog } from "./DocumentFlowDialog";
import { usePendingUploadStore } from "../../../store/usePendingUploadStore";
import { BACKGROUND_ROUTES_ID } from "../../../constants/dom";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

const background = {
	pathname: "/profile/documents",
	search: "",
	hash: "",
	state: null,
	key: "background",
} as Location;

const uploadStep = (
	<div>
		<button type="button">Datei auswählen</button>
		<button type="button">Dokument verarbeiten</button>
	</div>
);

const renderDialog = (step: React.ReactNode = <p>upload step</p>) =>
	render(
		<MemoryRouter initialEntries={["/profile/personal/upload"]}>
			<Routes>
				<Route element={<DocumentFlowDialog background={background} />}>
					<Route path="/profile/personal/upload" element={step} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);

describe("DocumentFlowDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the current flow step inside a modal dialog", () => {
		renderDialog();

		const dialog = screen.getByTestId("document-flow-dialog");
		expect(dialog).toHaveAttribute("aria-modal", "true");
		expect(dialog).toHaveTextContent("upload step");
	});

	it("returns to the page it was opened from on escape", () => {
		renderDialog();

		fireEvent.keyDown(window, { key: "Escape" });

		expect(mockNavigate).toHaveBeenCalledWith("/profile/documents", {
			replace: true,
		});
	});

	it("returns to the page it was opened from when the backdrop is clicked", () => {
		renderDialog();

		fireEvent.click(screen.getByTestId("document-flow-backdrop"));

		expect(mockNavigate).toHaveBeenCalledWith("/profile/documents", {
			replace: true,
		});
	});

	it("stays open when the dialog itself is clicked", () => {
		renderDialog();

		fireEvent.click(screen.getByTestId("document-flow-dialog"));

		expect(mockNavigate).not.toHaveBeenCalled();
	});

	it("moves focus to the first control of the step", () => {
		renderDialog(uploadStep);

		expect(
			screen.getByRole("button", { name: "Datei auswählen" }),
		).toHaveFocus();
	});

	it("falls back to the dialog itself while the step is still loading", () => {
		renderDialog();

		expect(screen.getByTestId("document-flow-dialog")).toHaveFocus();
	});

	it("keeps tabbing inside the dialog", () => {
		renderDialog(uploadStep);

		const first = screen.getByRole("button", { name: "Datei auswählen" });
		const last = screen.getByRole("button", { name: "Dokument verarbeiten" });

		last.focus();
		fireEvent.keyDown(last, { key: "Tab" });
		expect(first).toHaveFocus();

		fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
		expect(last).toHaveFocus();
	});

	it("returns focus to the element that opened the flow", () => {
		const trigger = document.createElement("button");
		document.body.appendChild(trigger);
		trigger.focus();

		const { unmount } = renderDialog(uploadStep);
		unmount();

		expect(trigger).toHaveFocus();
		trigger.remove();
	});

	it("leaves escape to a modal opened inside the step", () => {
		renderDialog(
			<div>
				<button type="button">Datei auswählen</button>
				<div role="dialog" aria-modal="true">
					<button type="button">Löschen</button>
				</div>
			</div>,
		);

		fireEvent.keyDown(window, { key: "Escape" });

		expect(mockNavigate).not.toHaveBeenCalled();
	});

	it("skips hidden controls when trapping focus", () => {
		renderDialog(
			<div>
				<button type="button">Datei auswählen</button>
				<button type="button">Dokument verarbeiten</button>
				<input type="file" style={{ display: "none" }} />
			</div>,
		);

		const first = screen.getByRole("button", { name: "Datei auswählen" });
		const last = screen.getByRole("button", { name: "Dokument verarbeiten" });

		last.focus();
		fireEvent.keyDown(last, { key: "Tab" });

		expect(first).toHaveFocus();
	});

	it("drops a file that was never staged when it closes", () => {
		const file = new File(["pdf"], "ausweis.pdf", { type: "application/pdf" });
		usePendingUploadStore.getState().setPendingFile(file);

		const { unmount } = renderDialog(uploadStep);
		unmount();

		expect(usePendingUploadStore.getState().pendingFile).toBeNull();
	});

	it("locks background scrolling while open", () => {
		const { unmount } = renderDialog();
		expect(document.body.style.overflow).toBe("hidden");

		unmount();
		expect(document.body.style.overflow).toBe("");
	});

	it("makes the page behind it inert and interactive again on close", () => {
		const backgroundRoot = document.createElement("div");
		backgroundRoot.id = BACKGROUND_ROUTES_ID;
		document.body.appendChild(backgroundRoot);

		const { unmount } = renderDialog();
		expect(backgroundRoot).toHaveAttribute("inert");

		unmount();
		expect(backgroundRoot).not.toHaveAttribute("inert");

		backgroundRoot.remove();
	});

	it("restores focus to a trigger inside the background once it is interactive", () => {
		const backgroundRoot = document.createElement("div");
		backgroundRoot.id = BACKGROUND_ROUTES_ID;
		const trigger = document.createElement("button");
		backgroundRoot.appendChild(trigger);
		document.body.appendChild(backgroundRoot);
		trigger.focus();

		let inertWhenRefocused: boolean | null = null;
		const nativeFocus = trigger.focus.bind(trigger);
		vi.spyOn(trigger, "focus").mockImplementation(() => {
			inertWhenRefocused = backgroundRoot.hasAttribute("inert");
			nativeFocus();
		});

		const { unmount } = renderDialog(uploadStep);
		unmount();

		// jsdom does not enforce inert, so assert the ordering a browser needs:
		// the background has to be interactive again before focus returns to it.
		expect(inertWhenRefocused).toBe(false);
		expect(trigger).toHaveFocus();

		backgroundRoot.remove();
	});

	it("leaves an already inert background inert when it closes", () => {
		const backgroundRoot = document.createElement("div");
		backgroundRoot.id = BACKGROUND_ROUTES_ID;
		backgroundRoot.setAttribute("inert", "");
		document.body.appendChild(backgroundRoot);

		const { unmount } = renderDialog();
		unmount();

		expect(backgroundRoot).toHaveAttribute("inert");

		backgroundRoot.remove();
	});
});
