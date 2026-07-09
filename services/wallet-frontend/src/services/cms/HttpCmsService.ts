import type { ICmsService } from "./ICmsService";
import type {
	TutorialResponse,
	TutorialProgressUpdatePayload,
} from "../../schemas/cms.schema";
import { TutorialResponseSchema } from "../../schemas/cms.schema";
import { env } from "../../config/env.config";
import { authenticatedFetch } from "../../utils/apiClient";

export class HttpCmsService implements ICmsService {
	async getMyTutorials(): Promise<TutorialResponse[]> {
		const response = await authenticatedFetch(
			`${env.VITE_API_URL}/cms/my-tutorials`,
			{
				credentials: "include",
			},
		);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch tutorials from CMS: ${response.statusText}`,
			);
		}
		const data = await response.json();
		if (!Array.isArray(data)) {
			return [];
		}
		return data.map((item) => TutorialResponseSchema.parse(item));
	}

	async updateTutorialProgress(
		payload: TutorialProgressUpdatePayload,
	): Promise<{ status: string }> {
		const response = await authenticatedFetch(
			`${env.VITE_API_URL}/cms/my-tutorials/progress`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				credentials: "include",
			},
		);
		if (!response.ok) {
			throw new Error(
				`Failed to update tutorial progress: ${response.statusText}`,
			);
		}
		return response.json();
	}
}
