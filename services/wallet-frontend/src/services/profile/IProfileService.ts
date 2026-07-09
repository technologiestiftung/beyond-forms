import type {
	Profile,
	ProfileUpdatePayload,
} from "../../schemas/profile.schema";

export interface ProfileResponse {
	success: boolean;
	message?: string;
	data?: {
		profile?: Profile;
		validation_status?: "draft" | "valid" | "unknown";
		rules_warnings?: Array<{ field_path: string; message: string }>;
		wizard_evaluation?: {
			visited_steps: string[];
			next_step: string;
			required_documents: string[];
			missing_fields: string[];
			pending_step_id: string | null;
		} | null;
	};
	validationErrors?: Array<{ field_path: string; message: string }>;
}

export interface IProfileService {
	/**
	 * Retrieves the full profile including all sections.
	 */
	getProfile(): Promise<Profile | null>;

	/**
	 * Updates a specific section of the profile.
	 * @param section The key of the section in ProfileSchema (e.g., 'personalData', 'financial')
	 * @param data The updated data for that section.
	 */
	updateProfileSection<K extends keyof Profile>(
		section: K,
		data: Partial<Profile[K]> & { validateEntireForm?: boolean },
	): Promise<ProfileResponse>;

	/**
	 * Submits the full profile data with full validation.
	 */
	submitProfile(data: ProfileUpdatePayload): Promise<ProfileResponse>;

	/**
	 * Deletes the user profile and all linked records/files on the server.
	 */
	deleteProfile(): Promise<void>;
}
