// lib/storage/sessionTypes.ts

export type Track =
  | "NY_FAMILY_PROTECTION_FROM_ABUSE"
  | "NY_FAMILY_CUSTODY"
  | "NY_HOUSING_LANDLORD_TENANT"
  | "GENERIC";

export type Role = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  ts: number;
};

export type TimelineItem = {
  id: string;
  date: string;
  event: string;
};

export type SessionFacts = {
  jurisdiction?: string; // e.g., "New York"
  track?: Track;

  // core
  goal_relief?: string;
  user_story?: string;

  // actors and places
  key_people?: string[];
  locations?: string[];

  // time
  key_dates?: string[];
  timeline?: TimelineItem[];

  // evidence
  evidence?: string[];

  // optional intake fields
  child_info?: string;
  relationship_context?: string;
  incidents?: Array<Record<string, any>>;

  // safety
  safety_flags?: string[];
  safety_level?: "none" | "concern" | "urgent";
};

export type SessionRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;

  // flow
  jurisdiction: string;
  track: Track;

  // data
  facts: SessionFacts;
  messages: ChatMessage[];

  // outputs cache (optional)
  outputs?: {
    generatedAt: number;
    payload: any;
  };
};

export type CreateSessionInput = {
  jurisdiction?: string;
  track?: Track;
};

export type AppendMessageInput = {
  sessionId: string;
  role: Role;
  content: string;
};

export type MergeFactsInput = {
  sessionId: string;
  patch: Partial<SessionFacts>;
};

export type SaveOutputsInput = {
  sessionId: string;
  outputs: any;
};