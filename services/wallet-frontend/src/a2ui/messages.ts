/** Builders for A2UI v0.9 messages, see https://a2ui.org. */

export const A2UI_VERSION = "v0.9";
export const KLARO_CATALOG_ID = "urn:beyond-forms:a2ui:catalog:klaro:v1";

export type A2uiComponent = { id: string; component: string } & Record<
	string,
	unknown
>;

export type A2uiMessage =
	| {
			version: typeof A2UI_VERSION;
			createSurface: { surfaceId: string; catalogId: string };
	  }
	| {
			version: typeof A2UI_VERSION;
			updateComponents: { surfaceId: string; components: A2uiComponent[] };
	  }
	| {
			version: typeof A2UI_VERSION;
			updateDataModel: { surfaceId: string; path?: string; value?: unknown };
	  }
	| { version: typeof A2UI_VERSION; deleteSurface: { surfaceId: string } };

export const createSurface = (surfaceId: string): A2uiMessage => ({
	version: A2UI_VERSION,
	createSurface: { surfaceId, catalogId: KLARO_CATALOG_ID },
});

export const updateComponents = (
	surfaceId: string,
	components: A2uiComponent[],
): A2uiMessage => ({
	version: A2UI_VERSION,
	updateComponents: { surfaceId, components },
});

export const newSurface = (
	prefix: string,
	components: A2uiComponent[],
): A2uiMessage[] => {
	const surfaceId = `${prefix}-${crypto.randomUUID()}`;
	return [createSurface(surfaceId), updateComponents(surfaceId, components)];
};

export const surfaceIdOf = (message: A2uiMessage): string => {
	if ("createSurface" in message) {
		return message.createSurface.surfaceId;
	}
	if ("updateComponents" in message) {
		return message.updateComponents.surfaceId;
	}
	if ("updateDataModel" in message) {
		return message.updateDataModel.surfaceId;
	}
	return message.deleteSurface.surfaceId;
};

export const event = (name: string, context: Record<string, unknown> = {}) => ({
	event: { name, context },
});
