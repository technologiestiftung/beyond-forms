import { HttpCmsService } from "./HttpCmsService";
import { MockCmsService } from "./MockCmsService";
import type { ICmsService } from "./ICmsService";
import { env } from "../../config/env.config";

export const cmsService: ICmsService =
	env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH
		? new MockCmsService()
		: new HttpCmsService();

export * from "./ICmsService";
