import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lazyWithRetry } from "./routeConfig";

describe("lazyWithRetry", () => {
	const originalLocation = window.location;
	let mockHref = "http://localhost:5173/test";

	beforeEach(() => {
		sessionStorage.clear();
		mockHref = "http://localhost:5173/test";
		Object.defineProperty(window, "location", {
			configurable: true,
			value: {
				reload: vi.fn(),
				get href() {
					return mockHref;
				},
				set href(val) {
					mockHref = val;
				},
			},
		});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		sessionStorage.clear();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
		vi.restoreAllMocks();
	});

	it("should resolve successfully when import succeeds", async () => {
		const mockComponent = () => null;
		const factory = vi.fn().mockResolvedValue({ default: mockComponent });
		const LazyComponent = lazyWithRetry(factory);

		const promise = (
			LazyComponent as unknown as {
				_payload: { _result: () => Promise<unknown> };
			}
		)._payload._result();
		await expect(promise).resolves.toEqual({ default: mockComponent });
		expect(window.location.reload).not.toHaveBeenCalled();
	});

	it("should trigger page reload with cache buster when factory fails with a ChunkLoadError", async () => {
		const chunkError = new Error("Failed to fetch dynamically imported module");
		chunkError.name = "ChunkLoadError";
		const factory = vi.fn().mockRejectedValue(chunkError);
		const LazyComponent = lazyWithRetry(factory);

		(
			LazyComponent as unknown as {
				_payload: { _result: () => Promise<unknown> };
			}
		)._payload._result();

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockHref).toContain("t=");
		expect(sessionStorage.getItem("chunk_load_retry_failed")).toBe("true");
	});

	it("should trigger page reload with cache buster when factory fails with generic fetch dynamic import message", async () => {
		const importError = new TypeError(
			"Failed to fetch dynamically imported module: http://assets/chunk.js",
		);
		const factory = vi.fn().mockRejectedValue(importError);
		const LazyComponent = lazyWithRetry(factory);

		(
			LazyComponent as unknown as {
				_payload: { _result: () => Promise<unknown> };
			}
		)._payload._result();

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockHref).toContain("t=");
		expect(sessionStorage.getItem("chunk_load_retry_failed")).toBe("true");
	});

	it("should not trigger reload and propagate error on consecutive failure to prevent infinite reload loops", async () => {
		sessionStorage.setItem("chunk_load_retry_failed", "true");

		const chunkError = new Error("Failed to fetch dynamically imported module");
		chunkError.name = "ChunkLoadError";
		const factory = vi.fn().mockRejectedValue(chunkError);
		const LazyComponent = lazyWithRetry(factory);

		const promise = (
			LazyComponent as unknown as {
				_payload: { _result: () => Promise<unknown> };
			}
		)._payload._result();
		await expect(promise).rejects.toThrow(
			"Failed to fetch dynamically imported module",
		);
		expect(window.location.reload).not.toHaveBeenCalled();
		expect(sessionStorage.getItem("chunk_load_retry_failed")).toBeNull();
	});

	it("should not reload page and should propagate error when factory fails with other generic errors", async () => {
		const normalError = new Error("Some other render error");
		const factory = vi.fn().mockRejectedValue(normalError);
		const LazyComponent = lazyWithRetry(factory);

		const promise = (
			LazyComponent as unknown as {
				_payload: { _result: () => Promise<unknown> };
			}
		)._payload._result();
		await expect(promise).rejects.toThrow("Some other render error");
		expect(window.location.reload).not.toHaveBeenCalled();
	});
});
