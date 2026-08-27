import { mapProfileToFrontend } from "../../utils/transform";
import type { Profile } from "../../schemas/profile.schema";
import { v4 as uuidv4 } from "uuid";

interface PersonaFixture {
  slug: string;
  phone_number: string;
  profile: Record<string, unknown>;
  documents?: Array<{
    document_type: string;
    status: string;
    display_name: string;
    [key: string]: unknown;
  }>;
}

interface PersonaOverrides {
  displayName?: string;
  personaAddress?: "Formal" | "Informal";
}

function mapPersonaDocument(doc: { document_type: string; status: string; display_name: string; [key: string]: unknown }) {
  const status = (doc.status || "").toLowerCase();
  const statusMap: Record<string, string> = {
    verified: "VERIFIED",
    pending: "PENDING",
    processing: "PROCESSING",
    completed: "COMPLETED",
    failed: "FAILED",
    ready_for_review: "READY_FOR_REVIEW",
  };

  return {
    id: uuidv4(),
    name: doc.display_name,
    type: doc.document_type,
    status: statusMap[status] || "PENDING",
    confidence: (doc as unknown as Record<string, unknown>).confidence_score || null,
    uploadDate: new Date().toISOString(),
  };
}

export function buildDemoProfileFromPersona(
  persona: PersonaFixture,
  overrides?: PersonaOverrides,
): Profile {
  // The persona fixture's profile is already in snake_case, matching the backend's flat structure
  const documents = (persona.documents as PersonaFixture["documents"]) || [];
  const profileData = {
    ...persona.profile,
    documents: documents.map(mapPersonaDocument),
  };

  // Use mapProfileToFrontend to convert snake_case to camelCase and validate
  const profile = mapProfileToFrontend(profileData);

  // Override UI presentation settings with persona-specific config (not profile facts)
  if (overrides?.displayName) {
    profile.settings.displayName = overrides.displayName;
  }
  if (overrides?.personaAddress) {
    profile.settings.personaAddress = overrides.personaAddress;
  }

  return profile;
}
