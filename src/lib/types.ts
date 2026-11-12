/**
 * Shapes the LXTranslator API sends and accepts.
 *
 * They mirror the server's JSON, so field names stay in snake_case. Each one
 * lists only what this client reads; the server may send more, and a field
 * added here should be one a component actually uses.
 */

/** A JSON request body. Helpers that take one pass it through untouched. */
export type JsonBody = Record<string, unknown>;

/** An ISO 8601 timestamp, as every date field is sent. */
export type Timestamp = string;

/** The signed in account. */
export interface Account {
  id: string;
  user_id: string;
  email: string;
  display_name?: string | null;
  description?: string | null;
  website_url?: string | null;
}

/** Whether a namespace is a person's own or an organization. */
export type NamespaceType = 'USER' | 'ORG';

/** A member's role inside an organization. */
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/** A namespace the account can act in. */
export interface Namespace {
  id: string;
  user_id: string;
  type: NamespaceType;
  role?: MemberRole | null;
  display_name?: string | null;
}

/** A namespace's editable profile, as the settings page reads it. */
export interface NamespaceProfile extends Namespace {
  description?: string | null;
  email?: string | null;
  website_url?: string | null;
}

/** A member of an organization. */
export interface Member {
  id: string;
  role: MemberRole;
  created_at: Timestamp;
  member: {
    user_id: string;
    email?: string | null;
    display_name?: string | null;
  };
}

/** A translation project. */
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  ai_provider?: string | null;
  ai_model?: string | null;
}

/** Where a file is in the translation pipeline. */
export type FileStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

/** An uploaded translation file. */
export interface ProjectFile {
  id: string;
  name?: string;
  filename: string;
  status: FileStatus;
  size?: number;
  key_count?: number;
  source_lang_code?: string;
  target_lang_codes?: string[];
  error_message?: string | null;
}

/** A platform this server can send work to, with the models it offers. */
export interface Provider {
  name: string;
  label: string;
  default_model?: string;
  models?: string[];
  embedding_models?: string[];
}

/** The platform catalogue. */
export interface ProviderCatalogue {
  providers: Provider[];
  default_provider?: string;
  default_model?: string;
}

/** A namespace credential for an AI platform. The key itself is never sent back. */
export interface AccountKey {
  id: string;
  provider: string;
  label?: string | null;
  key_name?: string | null;
  masked_key: string;
  chat_model?: string | null;
  embedding_model?: string | null;
  is_active: boolean;
  last_used_at?: Timestamp | null;
  last_error_at?: Timestamp | null;
  last_error_reason?: string | null;
}

/** A signed in session on the server. */
export interface SessionRecord {
  id: string;
  current?: boolean;
  user_agent?: string | null;
  created_at: Timestamp;
  last_used_at?: Timestamp | null;
}

/** An API token, as listed. The token string is only ever returned on creation. */
export interface ApiToken {
  id: string;
  name: string;
  masked_token: string;
  expires_at?: Timestamp | null;
  last_used_at?: Timestamp | null;
}

/** A linked provider account. */
export interface OauthIdentity {
  id: string;
  provider: string;
  provider_username?: string | null;
  last_login_at?: Timestamp | null;
}

/** A provider that can sign somebody in. */
export interface AuthProvider {
  name: string;
  label: string;
}

/** A sign in that either started a session or needs a second factor first. */
export type LoginResult =
  | { mfa_required: true; challenge_token: string }
  | ({ mfa_required?: false } & SessionGrant);

/** A started session: the token and who it belongs to. */
export interface SessionGrant {
  access_token: string;
  account: Account;
}

/** The second factor's current state. */
export interface TwoFactorStatus {
  enabled: boolean;
  recovery_codes_remaining?: number;
}

/** What setting up a second factor hands the browser to show. */
export interface TwoFactorEnrolment {
  secret: string;
  otpauth_url: string;
}

/** A shape a namespace can export its documents in. */
export interface ExportFormat {
  format_id: string;
  name: string;
  description?: string | null;
  built_in?: boolean;
  leaf_shape?: string;
  nested?: boolean;
  value_field?: string | null;
  hash_field?: string | null;
}

/** One question and answer in an assistant conversation. */
export interface ChatTurn {
  id: string;
  user_prompt: string;
  ai_answer: string;
}

/** A conversation with the assistant, as listed. */
export interface ChatSession {
  id: string;
  title?: string | null;
  turn_count?: number;
  created_at?: Timestamp;
  last_message_at?: Timestamp | null;
}

/** One tool the assistant called while answering. */
export interface ChatToolCall {
  name: string;
  ok: boolean;
  error?: string | null;
}

/**
 * A download the assistant offers. `lang` is null for an archive of every
 * language, in which case `langs` lists them.
 */
export interface ChatDownload {
  file_id: string;
  filename: string;
  lang: string | null;
  export_format?: string;
  langs: string[];
  format_name: string;
}

/** The assistant's answer to one message. */
export interface ChatReply {
  session_id: string;
  namespace: string;
  steps: number;
  token_usage: number;
  total_token_usage?: number;
  tool_calls: ChatToolCall[];
  stopped_by_tool?: boolean;
  downloads?: ChatDownload[];
}

/** A past message that matched a search. */
export interface ChatSearchMatch {
  id: string;
  session_id: string;
  user_prompt: string;
  score: number;
  created_at: Timestamp;
}

/** One language's translation of a key. */
export interface Translation {
  id: string;
  lang_code: string;
  translated_text: string;
}

/** One key of a file, with its master text and every translation. */
export interface TranslationKey {
  id: string;
  key_name: string;
  original_text: string;
  source_text?: string | null;
  text_hash?: string;
  translations?: Translation[];
}

/** A translation that fell behind a change to its master text. */
export interface StaleTranslation {
  key_name: string;
  lang_code: string;
}

/** Every key of a file, in every language. */
export interface FileTranslations {
  master_lang_code: string;
  available_locales: string[];
  keys: TranslationKey[];
  stale_translations?: StaleTranslation[];
}

/** One mismatch the consistency check found. */
export interface ConsistencyIssue {
  kind: string;
  key_name: string;
  lang_code: string;
  detail: string;
}

/** The consistency check's answer. */
export interface ConsistencyReport {
  consistent: boolean;
  issue_count: number;
  checked_key_count: number;
  checked_lang_codes: string[];
  issues: ConsistencyIssue[];
  truncated?: boolean;
}

/** One recorded API request. */
export interface UsageEntry {
  id: string;
  created_at: Timestamp;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  session_id?: string | null;
}

/** Recorded requests, totalled by credential. */
export interface UsageSummary {
  total_requests: number;
  failed_requests: number;
  window_days: number;
  by_credential: Array<{
    session_id: string | null;
    credential_kind?: string | null;
    requests: number;
    failed: number;
  }>;
}
