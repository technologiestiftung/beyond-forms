import type { ElementType } from "react";
import { ShieldAlert, Coins, Home, FileCheck, HeartPulse } from "lucide-react";
import {
	APPLICATION_DOCUMENT_GROUPS,
	REQUIRED_DOCUMENT_SLOTS,
} from "../../../config/applicationConfig";
import type { WalletDocument } from "../../../schemas/profile.schema";
import { doesDocumentMatchSlot } from "../../../utils/profile";

export const DOCUMENT_CATEGORY_ICONS: Record<string, ElementType> = {
	identity: ShieldAlert,
	income: Coins,
	housing: Home,
	declarations: FileCheck,
	health: HeartPulse,
};

export interface CategoryDocumentCount {
	documentCount: number;
	filledSlotCount: number;
	slotCount: number;
}

export const EMPTY_CATEGORY_COUNT: CategoryDocumentCount = {
	documentCount: 0,
	filledSlotCount: 0,
	slotCount: 0,
};

export function getCategoryDocumentCounts(
	documents: WalletDocument[],
): Record<string, CategoryDocumentCount> {
	const counts: Record<string, CategoryDocumentCount> = {};

	for (const category of APPLICATION_DOCUMENT_GROUPS) {
		const slots = REQUIRED_DOCUMENT_SLOTS.filter((slot) =>
			category.slotIds.includes(slot.id),
		);

		counts[category.id] = {
			documentCount: documents.filter((document) =>
				slots.some((slot) => doesDocumentMatchSlot(document, slot)),
			).length,
			filledSlotCount: slots.filter((slot) =>
				documents.some((document) => doesDocumentMatchSlot(document, slot)),
			).length,
			slotCount: slots.length,
		};
	}

	return counts;
}
