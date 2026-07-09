import type {
	Profile,
	ProfileUpdatePayload,
	PersonalData,
} from "../../schemas/profile.schema";
import {
	AddressSchema,
	FinancialDataSchema,
	DraftPersonalDataSchema,
	DraftProfileUpdatePayloadSchema,
	HousingDataSchema,
} from "../../schemas/profile.schema";
import type { IProfileService, ProfileResponse } from "./IProfileService";
import { env } from "../../config/env.config";
import {
	mapProfileToFrontend,
	mapPersonalDataToBackend,
	mapFinancialDataToBackend,
	toSnakeCase,
	sanitizeDraftPayload,
} from "../../utils/transform";
import { authenticatedFetch } from "../../utils/apiClient";

/**
 * Production implementation of ProfileService calling real backend APIs.
 */
export class HttpProfileService implements IProfileService {
	async getProfile(): Promise<Profile | null> {
		const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
			credentials: "include",
		});
		if (!response.ok) {
			if (response.status === 404) {
				return null;
			}
			throw new Error(`Failed to fetch profile: ${response.statusText}`);
		}
		const data = await response.json();
		return mapProfileToFrontend(data);
	}

	async updateProfileSection<K extends keyof Profile>(
		_section: K,
		data: Partial<Profile[K]> & { validateEntireForm?: boolean },
	): Promise<ProfileResponse> {
		const mappers: Record<string, (d: unknown) => Record<string, unknown>> = {
			personalData: (d) => {
				const sanitized = sanitizeDraftPayload(d);
				const parsed = DraftPersonalDataSchema.partial().parse(sanitized);
				return mapPersonalDataToBackend(parsed as Partial<PersonalData>);
			},
			address: (d) => {
				const sanitized = sanitizeDraftPayload(d);
				const parsed = AddressSchema.partial().parse(sanitized);
				return toSnakeCase(parsed) as Record<string, unknown>;
			},
			financial: (d) => {
				const sanitized = sanitizeDraftPayload(d);
				const parsed = FinancialDataSchema.partial().parse(sanitized);
				return mapFinancialDataToBackend(parsed);
			},
			housing: (d) => {
				const sanitized = sanitizeDraftPayload(d);
				const parsed = HousingDataSchema.partial().parse(sanitized);
				return toSnakeCase(parsed) as Record<string, unknown>;
			},
		};

		const { validateEntireForm, ...restData } = data;
		const mapper = mappers[_section];
		const payload = mapper
			? mapper(restData)
			: (toSnakeCase(sanitizeDraftPayload(restData)) as Record<
					string,
					unknown
				>);

		if (validateEntireForm !== undefined) {
			payload.validate_entire_form = validateEntireForm;
		}

		const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			credentials: "include",
		});

		if (!response.ok) {
			if (response.status === 422) {
				try {
					const errorData = await response.json();
					if (errorData.validation_errors) {
						const rawErrors = errorData.validation_errors as Array<{
							field_path: string;
							message: string;
						}>;
						const errorMessages = rawErrors
							.map((err) => {
								return `${err.field_path}: ${err.message}`;
							})
							.join(", ");
						return {
							success: false,
							message: `Validation failed: ${errorMessages}`,
							data: errorData,
							validationErrors: rawErrors,
						};
					}
				} catch (_e) {
					// Fallback to status text if JSON parsing fails
				}
			}
			return {
				success: false,
				message: `Failed to update profile: ${response.statusText}`,
			};
		}

		const responseData = await response.json();
		return { success: true, data: responseData };
	}

	async submitProfile(data: ProfileUpdatePayload): Promise<ProfileResponse> {
		const sanitized = sanitizeDraftPayload(data);
		const parsed = DraftProfileUpdatePayloadSchema.parse(sanitized);
		const payload = toSnakeCase(parsed) as Record<string, unknown>;

		payload.validate_entire_form = false;

		const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			credentials: "include",
		});

		if (!response.ok) {
			if (response.status === 422) {
				try {
					const errorData = await response.json();
					if (errorData.validation_errors) {
						const rawErrors = errorData.validation_errors as Array<{
							field_path: string;
							message: string;
						}>;
						const errorMessages = rawErrors
							.map((err) => `${err.field_path}: ${err.message}`)
							.join(", ");
						return {
							success: false,
							message: `Validation failed: ${errorMessages}`,
							data: errorData,
							validationErrors: rawErrors,
						};
					}
				} catch (_e) {
					// Fallback
				}
			}
			return {
				success: false,
				message: `Failed to submit profile: ${response.statusText}`,
			};
		}

		const responseData = await response.json();
		return { success: true, data: responseData };
	}

	async deleteProfile(): Promise<void> {
		const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
			method: "DELETE",
			credentials: "include",
		});
		if (!response.ok) {
			throw new Error(`Failed to delete profile: ${response.statusText}`);
		}
	}
}
