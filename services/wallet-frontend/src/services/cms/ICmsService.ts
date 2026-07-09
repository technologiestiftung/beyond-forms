import type {
	TutorialResponse,
	TutorialProgressUpdatePayload,
} from "../../schemas/cms.schema";

export interface ICmsService {
	getMyTutorials(): Promise<TutorialResponse[]>;
	updateTutorialProgress(
		payload: TutorialProgressUpdatePayload,
	): Promise<{ status: string }>;
}
