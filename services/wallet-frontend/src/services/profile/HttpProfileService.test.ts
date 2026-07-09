import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HttpProfileService } from "./HttpProfileService";
import { env } from "../../config/env.config";

describe("HttpProfileService (TDD Red Phase)", () => {
	let service: HttpProfileService;

	beforeEach(() => {
		service = new HttpProfileService();

		// Mock fetch globally for this suite
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation((url: string) => {
				if (url === `${env.VITE_API_URL}/profile`) {
					return Promise.resolve({
						ok: true,
						json: () =>
							Promise.resolve({
								personalData: {
									firstName: "Sandor",
									lastName: "Kovacs",
									dateOfBirth: "1950-01-01",
									placeOfBirth: "Budapest",
									legalGender: "Male",
								},
								address: {},
								contact: {},
								financial: { bankDetails: {} },
								documents: [],
								settings: {
									language: "de",
									notificationsEnabled: true,
									personaAddress: "Formal",
								},
							}),
					});
				}

				if (url === `${env.VITE_API_URL}/profile/personalData`) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve({ success: true }),
					});
				}

				return Promise.resolve({
					ok: false,
					status: 404,
					statusText: "Not Found",
				});
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("getProfile should return a profile", async () => {
		const profile = await service.getProfile();
		expect(profile).toBeDefined();
		expect(profile?.personalData?.firstName).toBe("Sandor");
	});

	it("updateProfileSection should return success", async () => {
		const response = await service.updateProfileSection("personalData", {
			firstName: "Sandor",
			lastName: "Kovacs",
			dateOfBirth: "1950-01-01",
			placeOfBirth: "Budapest",
			legalGender: "Male",
			nationality: "Hungarian",
		});
		expect(response.success).toBe(true);
	});

	it("updateProfileSection should return failure on server error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			}),
		);

		const response = await service.updateProfileSection("personalData", {
			firstName: "Sandor",
			lastName: "Kovacs",
			dateOfBirth: "1950-01-01",
			placeOfBirth: "Budapest",
			legalGender: "Male",
		});
		expect(response.success).toBe(false);
		expect(response.message).toContain("Internal Server Error");
	});

	it("getProfile should throw on 500 error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			}),
		);

		await expect(service.getProfile()).rejects.toThrow("Internal Server Error");
	});

	it("updateProfileSection should return specific validation errors on 422", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 422,
				statusText: "Unprocessable Entity",
				json: () =>
					Promise.resolve({
						status: "error",
						code: 422,
						detail: "Validation failed.",
						validation_errors: [
							{
								field_path: "nationality",
								message: "Field required",
								type: "missing",
							},
						],
					}),
			}),
		);

		const response = await service.updateProfileSection("personalData", {
			firstName: "Sandor",
			lastName: "Kovacs",
			dateOfBirth: "1950-01-01",
			placeOfBirth: "Budapest",
			legalGender: "Male",
		});
		expect(response.success).toBe(false);
		expect(response.message).toBe(
			"Validation failed: nationality: Field required",
		);
	});
});
