import { HttpProfileService } from "./HttpProfileService";
import { MockProfileService } from "./MockProfileService";
import type { IProfileService } from "./IProfileService";
import { env } from "../../config/env.config";

/**
 * Factory module that resolves the correct ProfileService implementation
 * based on environment configuration.
 */
export const profileService: IProfileService =
	env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH
		? new MockProfileService()
		: new HttpProfileService();

export * from "./IProfileService";
