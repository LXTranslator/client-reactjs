import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/apiClient.js';
import { Callout, EmptyState, ErrorMessage, LoadingState } from '../ui/Feedback.jsx';

/** How many entries the list shows before asking somebody to narrow it. */
const PAGE_SIZE = 50;

/**
 * What has been done on this account.
 *
 * Sits under the credentials rather than on a page of its own, because the
 * question it answers is the one the list above provokes: "there is a token
 * here I do not remember, what has it been doing". Two screens apart, nobody
 * ever asks it.
 *
 * The summary comes first for the same reason. A page of log lines answers
 * "what happened" and not "is anything wrong", and the counts are what make an
 * unfamiliar credential or a run of failures visible at a glance.
 *
 * @param {object} props Component props.
 * @param {Array<object>} [props.credentials] Sessions and tokens, for naming rows.
 * @returns {JSX.Element} The panel.
 */
export function UsagePanel({ credentials = [] }) {
  const [usage, setUsage] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  /**
   * Loads the list and the summary together.
   *
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usageResult, summaryResult] = await Promise.all([
        api.listUsage({
          limit: PAGE_SIZE,
          ...(filter === '' ? {} : { sessionId: filter }),
        }),
        api.getUsageSummary(),
      ]);

      setUsage(usageResult.usage ?? []);
      setSummary(summaryResult);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Names a credential, falling back to its identifier.
   *
   * A row whose credential has since been revoked and purged still has to read
   * as something: the record outlives the credential on purpose.
   *
   * @param {string|null} sessionId Credential identifier.
   * @returns {string} A label.
   */
  function describeCredential(sessionId) {
    if (sessionId === null || sessionId === undefined) return 'Unknown';
    const match = credentials.find((entry) => entry.id === sessionId);
    if (match === undefined) return 'Removed credential';
    return match.name ?? (match.current ? 'This device' : 'Another device');
  }

  if (isLoading && summary === null) {
    return (
      <section className="panel">
        <LoadingState label="Loading activity" />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Recent activity</h2>
        {summary === null ? null : (
          <span className="badge badge--accent">{summary.total_requests}</span>
        )}
      </div>

      <ErrorMessage error={loadError} />

      <p className="muted">
        Every request made with one of the credentials above. Nothing you sent is kept:
        no message bodies, no search terms, no addresses.
      </p>

      {summary !== null && summary.by_credential.length > 0 ? (
        <div className="keylist">
          {summary.by_credential.map((entry) => (
            <div className="keylist__item" key={entry.session_id ?? 'unknown'}>
              <div className="keylist__body">
                <div className="keylist__label">
                  {describeCredential(entry.session_id)}{' '}
                  <span className="badge">{entry.credential_kind ?? 'unknown'}</span>
                </div>
                <div className="keylist__meta">
                  {entry.requests} request{entry.requests === 1 ? '' : 's'} in the last{' '}
                  {summary.window_days} days
                  {entry.failed > 0 ? ` · ${entry.failed} failed` : ''}
                </div>
              </div>

              <div className="keylist__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() =>
                    setFilter((current) =>
                      current === entry.session_id ? '' : (entry.session_id ?? ''),
                    )
                  }
                >
                  {filter === entry.session_id ? 'Show all' : 'Only this'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {summary !== null && summary.failed_requests > 0 ? (
        <Callout tone="info" title="Some requests failed">
          {summary.failed_requests} of {summary.total_requests} were refused or errored. A
          few are ordinary; a run of them from one credential is worth looking at.
        </Callout>
      ) : null}

      {usage.length === 0 ? (
        <EmptyState title="Nothing recorded yet.">
          <p className="muted">Activity appears here as soon as anything uses the API.</p>
        </EmptyState>
      ) : (
        <div className="usage-log" role="table" aria-label="Recent requests">
          <div className="usage-log__row usage-log__row--head" role="row">
            <span role="columnheader">When</span>
            <span role="columnheader">Request</span>
            <span role="columnheader">Result</span>
            <span role="columnheader">Credential</span>
          </div>

          {usage.map((entry) => (
            <div className="usage-log__row" role="row" key={entry.id}>
              <span role="cell" className="muted">
                {new Date(entry.created_at).toLocaleString()}
              </span>
              <span role="cell" className="mono">
                {entry.method} {entry.path}
              </span>
              <span role="cell">
                <span
                  className={`badge ${entry.status_code >= 400 ? 'badge--danger' : 'badge--ok'}`}
                >
                  {entry.status_code}
                </span>{' '}
                <span className="muted">{entry.duration_ms}ms</span>
              </span>
              <span role="cell" className="muted">
                {describeCredential(entry.session_id)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
