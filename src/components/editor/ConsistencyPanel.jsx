import { useState } from 'react';
import { api } from '../../lib/apiClient.js';
import { Callout, EmptyState, ErrorMessage } from '../ui/Feedback.jsx';

/**
 * On demand consistency check between the master and every other language.
 *
 * A translation can drift structurally away from its master without either
 * string looking wrong on its own: a dropped `{name}`, a token retyped in the
 * target language, a locale that never covered every key. The failure only
 * appears at runtime, as a literal brace on screen or a formatter handed fewer
 * arguments than its format string expects.
 *
 * The check runs when a person asks for it and never as a side effect of an
 * edit. The server reads every key and every translation of the file to answer
 * it, which is exactly the work that has no business running while somebody is
 * typing.
 *
 * @param {object} props Component props.
 * @param {string} props.fileId File to check.
 * @param {string[]} props.locales Locales available on the file.
 * @returns {JSX.Element} The panel.
 */
export function ConsistencyPanel({ fileId, locales }) {
  const [report, setReport] = useState(null);
  const [lang, setLang] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Runs the check.
   *
   * @returns {Promise<void>}
   */
  async function handleCheck() {
    setError(null);
    setIsChecking(true);
    try {
      const result = await api.checkConsistency(fileId, lang === '' ? undefined : lang);
      setReport(result);
    } catch (caught) {
      setError(caught);
      setReport(null);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Key consistency</h2>
        {report ? (
          <span className={`badge ${report.consistent ? 'badge--ok' : 'badge--warn'}`}>
            {report.consistent ? 'consistent' : `${report.issue_count} to review`}
          </span>
        ) : null}
      </div>

      <p className="muted">
        Compares the placeholders and tags in every language against the English master.
        Runs only when you ask, because it reads every key and every translation.
      </p>

      <div className="editor__locales" style={{ marginBottom: '0.75rem' }}>
        <label className="field__label editor__compare-label" htmlFor="consistency_lang">
          Check
        </label>
        <select
          id="consistency_lang"
          className="field__control editor__compare"
          value={lang}
          onChange={(event) => setLang(event.target.value)}
        >
          <option value="">Every language</option>
          {locales.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn--primary"
          disabled={isChecking}
          onClick={handleCheck}
        >
          {isChecking ? 'Checking' : 'Validate key consistency'}
        </button>
      </div>

      <ErrorMessage error={error} />

      {report === null ? null : report.consistent ? (
        <Callout tone="ok" title="Every language matches the master">
          Checked {report.checked_key_count} key
          {report.checked_key_count === 1 ? '' : 's'} across{' '}
          {report.checked_lang_codes.join(', ') || 'no languages'}.
        </Callout>
      ) : (
        <ConsistencyIssues report={report} />
      )}
    </section>
  );
}

/** What each issue kind means, in the words a reviewer would use. */
const ISSUE_LABELS = {
  MISSING_TRANSLATION: 'No translation',
  EMPTY_TRANSLATION: 'Empty translation',
  STALE_TRANSLATION: 'Behind the master',
  PLACEHOLDER_MISSING: 'Placeholder missing',
  PLACEHOLDER_UNEXPECTED: 'Unexpected placeholder',
};

/**
 * The issue list, grouped so a repeated problem reads as one thing.
 *
 * @param {object} props Component props.
 * @param {object} props.report The consistency report.
 * @returns {JSX.Element} The list.
 */
function ConsistencyIssues({ report }) {
  const byKind = new Map();
  for (const issue of report.issues) {
    if (!byKind.has(issue.kind)) byKind.set(issue.kind, []);
    byKind.get(issue.kind).push(issue);
  }

  if (report.issues.length === 0) {
    return <EmptyState title="No issues were listed." />;
  }

  return (
    <>
      {report.truncated ? (
        <Callout tone="info">
          Showing the first {report.issues.length} of {report.issue_count} issues.
        </Callout>
      ) : null}

      {[...byKind.entries()].map(([kind, issues]) => (
        <div key={kind} className="consistency__group">
          <h3 className="consistency__kind">
            {ISSUE_LABELS[kind] ?? kind} <span className="badge">{issues.length}</span>
          </h3>

          <ul className="consistency__list">
            {issues.map((issue, index) => (
              <li key={`${issue.key_name}_${issue.lang_code}_${index}`}>
                <span className="mono">{issue.key_name}</span>{' '}
                <span className="badge badge--accent">{issue.lang_code}</span>
                <span className="consistency__detail">{issue.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
