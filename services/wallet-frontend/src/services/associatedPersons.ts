import type { ChildEntry } from "../schemas/benefitCheck.schema";

/**
 * One row of the profile's `associated_persons`, as `GET /profile` returns it. Typed
 * loosely on purpose: the frontend's Profile schema does not carry this collection, and
 * only the fields this merge reasons about are named.
 */
export interface AssociatedPersonRow {
	association_type: string;
	lives_in_household?: boolean;
	sort_order?: number;
	date_of_birth?: string | null;
	[key: string]: unknown;
}

const CHILD = "Child";

/**
 * Folds the questionnaire's children into an existing collection.
 *
 * POST /profile replaces `associated_persons` wholesale — the writer in user_service.py
 * says so explicitly, so that the PDFs' fixed person slots do not shift. Sending only
 * the children would therefore delete a partner the chat assistant had recorded.
 *
 * Rules:
 *   - non-child rows are kept, in their original order
 *   - a child row whose date of birth the applicant named again is kept, so a name
 *     recorded elsewhere survives
 *   - children with no matching row are appended
 *   - child rows the applicant did not name again are dropped: they just told us who
 *     lives in the household
 *   - sort_order is renumbered by position, mirroring what the server does, so the
 *     payload is self-consistent
 */
export const mergeChildren = (
	existing: AssociatedPersonRow[],
	children: ChildEntry[],
): AssociatedPersonRow[] => {
	const unclaimed = children.map((entry) => entry.dateOfBirth);
	const kept: AssociatedPersonRow[] = [];

	for (const row of existing) {
		if (row.association_type !== CHILD) {
			kept.push(row);
			continue;
		}
		const match = unclaimed.indexOf(row.date_of_birth ?? "");
		if (match !== -1) {
			unclaimed.splice(match, 1);
			kept.push(row);
		}
	}

	for (const dateOfBirth of unclaimed) {
		kept.push({
			association_type: CHILD,
			lives_in_household: true,
			sort_order: 0,
			date_of_birth: dateOfBirth,
		});
	}

	return kept.map((row, index) => ({ ...row, sort_order: index }));
};
