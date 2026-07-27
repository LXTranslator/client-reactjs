import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '../../lib/paths.js';
import { Callout, ErrorMessage } from '../ui/Feedback.jsx';

/**
 * What each tool actually did, in the words a person would use.
 *
 * A name with no entry falls through to the raw one, so a tool added on the
 * server appears here as soon as it is used rather than vanishing from the
 * report. This map is what makes it readable, not what makes it appear.
 */
const TOOL_LABELS = {
  switch_namespace: 'Switched namespace',
  list_projects: 'Listed projects',
  create_project: 'Created a project',
  upload_file: 'Uploaded a file',
  list_files: 'Listed files',
  check_project_languages: 'Checked project languages',
  get_project_description: 'Read a description',
  update_project_description: 'Updated a description',
  list_platforms: 'Listed AI platforms',
  update_project_ai: 'Set the AI platform and model',
  add_languages: 'Added languages',
  list_export_formats: 'Listed export formats',
  create_export_format: 'Created an export format',
  export_file: 'Prepared a download',
  find_chat: 'Searched past conversations',
  stop: 'Finished',
};

/**
 * The context pane: what the assistant did, and what it cost.
 *
 * The assistant acts on real data, so the actions it took are shown rather than
 * left implicit in a paragraph of prose. A refused tool is shown as refused,
 * which is the honest report: the server checks permission itself on every call
 * and the answer above may be describing a refusal rather than a result.
 *
 * @param {object} props Component props.
 * @param {object} props.namespace The namespace the page is acting in.
 * @param {object|null} props.lastTurn The most recent response.
 * @param {number} props.totalTokens Tokens spent in this conversation.
 * @param {Function} props.onBackfill Runs an embedding backfill.
 * @returns {JSX.Element} The pane.
 */
export function ChatContextPane({ namespace, lastTurn, totalTokens, onBackfill }) {
  const [backfill, setBackfill] = useState(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Embeds past exchanges that have no vector yet.
   *
   * @returns {Promise<void>}
   */
  async function handleBackfill() {
    setError(null);
    setIsBackfilling(true);
    try {
      setBackfill(await onBackfill());
    } catch (caught) {
      setError(caught);
    } finally {
      setIsBackfilling(false);
    }
  }

  return (
    <aside className="chat__pane chat__pane--context" aria-label="Assistant context">
      <div className="chat__pane-header">
        <h2>Context</h2>
      </div>

      <dl className="chat__facts">
        <dt>Acting in</dt>
        <dd>
          <span className="mono">{lastTurn?.namespace ?? namespace.user_id}</span>
          {lastTurn && lastTurn.namespace !== namespace.user_id ? (
            <span className="badge badge--warn">switched</span>
          ) : null}
        </dd>

        <dt>This conversation</dt>
        <dd>{totalTokens.toLocaleString()} tokens</dd>

        {lastTurn ? (
          <>
            <dt>Last answer</dt>
            <dd>
              {lastTurn.steps} step{lastTurn.steps === 1 ? '' : 's'},{' '}
              {lastTurn.token_usage.toLocaleString()} tokens
            </dd>
          </>
        ) : null}
      </dl>

      {lastTurn && lastTurn.namespace !== namespace.user_id ? (
        <Callout tone="warn" title="The assistant switched namespace">
          It is now acting in <span className="mono">{lastTurn.namespace}</span>. It proved
          your membership before switching; naming one you do not belong to would have
          failed.
        </Callout>
      ) : null}

      <div className="chat__section">
        <h3>What it did</h3>
        {lastTurn === null ? (
          <p className="muted">Nothing yet.</p>
        ) : lastTurn.tool_calls.length === 0 ? (
          <p className="muted">Answered from the conversation, without acting.</p>
        ) : (
          <ul className="chat__tools">
            {lastTurn.tool_calls.map((call, index) => (
              <li key={`${call.name}_${index}`} className="chat__tool">
                <span className={`badge ${call.ok ? 'badge--ok' : 'badge--danger'}`}>
                  {call.ok ? 'done' : 'refused'}
                </span>
                <span>{TOOL_LABELS[call.name] ?? call.name}</span>
                {call.ok ? null : <span className="chat__tool-error">{call.error}</span>}
              </li>
            ))}
          </ul>
        )}

        {lastTurn?.stopped_by_tool ? (
          <p className="field__hint">It stopped on its own rather than running out of steps.</p>
        ) : null}
      </div>

      <div className="chat__section">
        <h3>Search</h3>
        <p className="muted">
          Past conversations are searched by meaning when an embedding model is configured,
          and by text otherwise.
        </p>

        <ErrorMessage error={error} />

        {backfill === null ? null : backfill.configured === false ? (
          <Callout tone="info" title="No embedding model">
            Nothing was embedded because this namespace has no embedding model. The
            assistant is unaffected; only search by meaning is.
          </Callout>
        ) : (
          <Callout tone="ok">
            Embedded {backfill.embedded}. {backfill.remaining} still waiting.
          </Callout>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--small"
            onClick={handleBackfill}
            disabled={isBackfilling}
          >
            {isBackfilling ? 'Embedding' : 'Embed past conversations'}
          </button>
          <Link className="btn btn--small btn--ghost" to={paths.namespaceAiSettings(namespace.user_id)}>
            AI settings
          </Link>
        </div>
      </div>
    </aside>
  );
}
