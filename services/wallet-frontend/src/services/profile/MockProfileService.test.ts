import { describe, it, expect, beforeEach } from "vitest";
import { MockProfileService } from "./MockProfileService";
import type { Profile, WalletDocument } from "../../schemas/profile.schema";

const doc: WalletDocument = {
	id: "doc-1",
	name: "Personalausweis.pdf",
	type: "id_card",
	status: "VERIFIED",
	uploadDate: "2026-01-01T00:00:00.000Z",
};

describe("MockProfileService", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("keeps documents as an array when updating the documents section", async () => {
		const service = new MockProfileService();

		const { data } = await service.updateProfileSection("documents", [
			doc,
		] as unknown as Partial<Profile["documents"]>);

		expect(Array.isArray(data?.profile?.documents)).toBe(true);
		expect(data?.profile?.documents).toEqual([doc]);
		const stored = await service.getProfile();
		expect(stored.documents).toEqual([doc]);
	});
});
