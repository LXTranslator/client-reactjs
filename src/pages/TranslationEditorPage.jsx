import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useNamespace } from '../components/routing/NamespaceRoute.jsx';
import { paths } from '../lib/paths.js';
import { api } from '../lib/apiClient.js';
import { downloadJson, triggerDownload } from '../lib/download.js';
import { FileGrowthPanel } from '../components/editor/FileGrowthPanel.jsx';
import { localeLabel } from '../lib/locales.js';

/** The name the server always serves the archive under, whatever the format. */
const ARCHIVE_FILENAME = 'langs.zip';

/** The format used when none is chosen, matching the server's own default. */
const DEFAULT_FORMAT_ID = 'default';
import {
  Callout,
  EmptyState,
  ErrorMessage,
  LoadingState,
  StatusBadge,
} from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';

/** How often to re-check a file that is still being processed. */
const POLL_INTERVAL_MS = 2000;

/**
 * Translation editor and download page.
 *
 * Pairs each English master string with its translation in the selected locale
 * so a reviewer can read them side by side and correct anything the model got
 * wrong. A corrected row is flagged manual by the server, which protects it
 * from being overwritten if the pipeline runs again.
 *
 * @returns {JSX.Element} The page.
 */
export function TranslationEditorPage() {
  const { projectId, fileId } = useParams();
  const namespace = useNamespace();
  const ns = namespace.user_id;

  const [data, setData] = useState(null);
  const [activeLocale, setActiveLocale] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState({});
  const [file, setFile] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [exportFormats, setExportFormats] = useState([]);
  const [exportFormat, setExportFormat] = useState(DEFAULT_FORMAT_ID);

  const isProcessing = file?.status === 'PENDING' || file?.status === 'PROCESSING';

  /**
   * Loads the file record and, once it is ready, the editor payload.
   *
   * @param {boolean} [quiet] Skip the loading state, used by the poll.
   * @returns {Promise<void>}
   */
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setIsLoading(true);
      try {
        const fileResult = await api.getFile(fileId);
        setFile(fileResult.file);

        if (fileResult.file.status === 'READY') {
          const result = await api.getTranslations(fileId);
          setData(result);
          setActiveLocale((current) => {
            if (current && result.available_locales.includes(current)) return current;
            // Default to the first locale that is not the master, since the
            // master is the source being reviewed against.
            return (
              result.available_locales.find((code) => code !== result.master_lang_code) ??
              result.master_lang_code
            );
          });
        }
        setLoadError(null);
      } catch (error) {
        setLoadError(error);
      } finally {
        if (!quiet) setIsLoading(false);
      }
    },
    [fileId],
  );

  useEffect(() => {
    load();
  }, [load]);

  /*
   * The format catalogue is loaded once and separately. It belongs to the
   * namespace rather than to the file, so it does not change while the pipeline
   * runs and has no business being re-fetched by the poll below. A failure here
   * leaves the built in default selected rather than blocking the editor.
   */
  useEffect(() => {
    let cancelled = false;

    api
      .listFileExportFormats(fileId)
      .then((result) => {
        if (!cancelled) setExportFormats(result.export_formats ?? []);
      })
      .catch(() => {
        if (!cancelled) setExportFormats([]);
      });

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  /* Poll only while the pipeline is still running. */
  useEffect(() => {
    if (!isProcessing) return undefined;
    const timer = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isProcessing, load]);

  /**
   * Saves a corrected translation.
   *
   * @param {string} translationId Translation identifier.
   * @param {string} text Corrected text.
   * @returns {Promise<void>}
   */
  async function handleSaveTranslation(translationId, text) {
    setActionError(null);
    setSavingId(translationId);
    try {
      await api.updateTranslation(fileId, translationId, { translated_text: text });
      setSavedIds((current) => ({ ...current, [translationId]: true }));
      // Clear the confirmation after a moment so it does not linger.
      setTimeout(
        () => setSavedIds((current) => ({ ...current, [translationId]: false })),
        2000,
      );
      await load(true);
    } catch (error) {
      setActionError(error);
    } finally {
      setSavingId(null);
    }
  }

  /**
   * Saves a corrected master string, which restamps its fingerprint.
   *
   * @param {string} keyId Key identifier.
   * @param {string} text Corrected master text.
   * @returns {Promise<void>}
   */
  async function handleSaveMaster(keyId, text) {
    setActionError(null);
    setSavingId(keyId);
    try {
      await api.updateMasterText(fileId, keyId, { original_text: text });
      await load(true);
    } catch (error) {
      setActionError(error);
    } finally {
      setSavingId(null);
    }
  }

  /**
   * Downloads a single locale document.
   *
   * @returns {Promise<void>}
   */
  async function handleDownloadLocale() {
    setActionError(null);
    try {
      const document = await api.downloadLocale(fileId, activeLocale, exportFormat);
      downloadJson(`${activeLocale}.json`, document);
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Downloads every locale as one archive.
   *
   * One file rather than one download per language, which a browser blocks
   * after the first few anyway once it decides the page is spamming downloads.
   *
   * @returns {Promise<void>}
   */
  async function handleDownloadArchive() {
    setActionError(null);
    setIsArchiving(true);
    try {
      const archive = await api.downloadArchive(fileId, exportFormat);
      triggerDownload(ARCHIVE_FILENAME, archive);
    } catch (error) {
      setActionError(error);
    } finally {
      setIsArchiving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Loading translations" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container narrow">
        <ErrorMessage error={loadError} />
        <Link className="btn" to={paths.project(ns, projectId)}>
          Back to project
        </Link>
      </div>
    );
  }

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: 'Namespaces', to: paths.namespaces() },
        { label: ns, to: paths.namespace(ns) },
        { label: 'Project', to: paths.project(ns, projectId) },
        { label: file?.filename ?? 'File' },
      ]}
    />
  );

  if (isProcessing) {
    return (
      <div className="container narrow">
        {breadcrumbs}
        <h1>{file?.filename}</h1>
        <Callout tone="info" title="Translation in progress">
          <span className="spinner" aria-hidden="true" /> The file is being translated on a
          worker thread. This page refreshes automatically.
        </Callout>
      </div>
    );
  }

  if (file?.status === 'FAILED') {
    return (
      <div className="container narrow">
        {breadcrumbs}
        <h1>{file.filename}</h1>
        <Callout tone="danger" title="Translation failed">
          {file.error_message ?? 'The translation could not be completed.'}
        </Callout>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await api.reprocessFile(fileId);
              await load();
            }}
          >
            Try again
          </button>
          <Link className="btn" to={paths.projectSettings(ns, projectId)}>
            Check API keys
          </Link>
        </div>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="container narrow">
        {breadcrumbs}
        <EmptyState title="No translations available yet." />
      </div>
    );
  }

  /*
   * A format with no hash field cannot carry staleness into the downloaded
   * file, which is a real trade rather than a detail: `key_value` is chosen
   * precisely because it drops straight into an application, and the cost is
   * that the file stops describing whether it is current.
   */
  const selectedFormat =
    exportFormats.find((format) => format.format_id === exportFormat) ?? null;

  const staleByKey = new Map(
    (data.stale_translations ?? []).map((entry) => [
      `${entry.key_name}_${entry.lang_code}`,
      entry,
    ]),
  );

  return (
    <div className="container">
      {breadcrumbs}

      <div className="editor__toolbar">
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>{file?.filename}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {data.keys.length} keys, master locale{' '}
            <span className="mono">{data.master_lang_code}</span>{' '}
            <StatusBadge status={file?.status ?? 'READY'} />
          </p>
        </div>

        <div className="editor__download">
          {exportFormats.length > 1 ? (
            <div className="editor__locales">
              <label className="field__label editor__compare-label" htmlFor="export_format">
                Format
              </label>
              <select
                id="export_format"
                className="field__control editor__compare"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value)}
              >
                {exportFormats.map((format) => (
                  <option key={format.format_id} value={format.format_id}>
                    {format.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="btn-row">
            <button type="button" className="btn" onClick={handleDownloadLocale}>
              Download {activeLocale}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={isArchiving}
              onClick={handleDownloadArchive}
            >
              {isArchiving ? 'Preparing…' : `Download all (${ARCHIVE_FILENAME})`}
            </button>
          </div>
        </div>
      </div>

      {selectedFormat !== null && selectedFormat.hash_field === null ? (
        <Callout tone="info" title={`Downloads use the ${selectedFormat.name} format`}>
          This format carries no fingerprint, so a consumer cannot tell from the file alone
          that an English source string changed. The stale markers on this page still show
          it.
        </Callout>
      ) : null}

      <ErrorMessage error={actionError} />

      {data.stale_translations?.length > 0 ? (
        <Callout tone="warn" title="Some translations are out of date">
          {data.stale_translations.length} translation
          {data.stale_translations.length === 1 ? '' : 's'} were produced from an older
          version of the English text. Their tracking hash no longer matches the source.
        </Callout>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Language</h2>
          <div className="editor__locales">
            <label className="field__label editor__compare-label" htmlFor="compare_locale">
              Compare with
            </label>
            <select
              id="compare_locale"
              className="field__control editor__compare"
              value={activeLocale ?? ''}
              onChange={(event) => setActiveLocale(event.target.value)}
            >
              {data.available_locales.map((code) => (
                <option key={code} value={code}>
                  {code === data.master_lang_code
                    ? `${localeLabel(code)} (${code}) — master`
                    : `${localeLabel(code)} (${code})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {data.keys.length === 0 ? (
          <EmptyState title="This file has no translatable keys." />
        ) : (
          data.keys.map((key) => (
            <EditorRow
              key={key.id}
              entry={key}
              locale={activeLocale}
              masterLocale={data.master_lang_code}
              stale={staleByKey.get(`${key.key_name}_${activeLocale}`) ?? null}
              savingId={savingId}
              savedIds={savedIds}
              onSaveTranslation={handleSaveTranslation}
              onSaveMaster={handleSaveMaster}
            />
          ))
        )}
      </section>

      <FileGrowthPanel
        fileId={fileId}
        existingLocales={data.available_locales}
        onStarted={load}
      />
    </div>
  );
}

/**
 * One editable key: the English master beside its translation.
 *
 * @param {object} props Component props.
 * @returns {JSX.Element} The row.
 */
function EditorRow({
  entry,
  locale,
  masterLocale,
  stale,
  savingId,
  savedIds,
  onSaveTranslation,
  onSaveMaster,
}) {
  const translation = entry.translations?.find((item) => item.lang_code === locale) ?? null;
  const isMasterView = locale === masterLocale;

  const [draft, setDraft] = useState(
    isMasterView ? entry.original_text : (translation?.translated_text ?? ''),
  );

  // Re-sync when the locale changes or the server sends fresh data.
  useEffect(() => {
    setDraft(isMasterView ? entry.original_text : (translation?.translated_text ?? ''));
  }, [isMasterView, entry.original_text, translation?.translated_text, locale]);

  const targetId = isMasterView ? entry.id : translation?.id;
  const isSaving = savingId === targetId;
  const isSaved = Boolean(savedIds[targetId]);
  const isDirty = isMasterView
    ? draft !== entry.original_text
    : draft !== (translation?.translated_text ?? '');

  return (
    <div className={`editor__row${isMasterView ? ' editor__row--single' : ''}`}>
      <div className="editor__key">
        <span className="editor__key-name">{entry.key_name}</span>
        {translation?.is_manual ? <span className="badge badge--ok">manual</span> : null}
        {stale ? <span className="badge badge--warn">stale</span> : null}
        <span className="editor__hash" title="Tracking hash of the English source text">
          {entry.text_hash}
        </span>
      </div>

      {/*
        The master and en_us are one and the same text, so comparing the master
        against itself would print every string twice. Selecting it drops the
        read only column and leaves the master editable on its own.
      */}
      {isMasterView ? null : (
        <div>
          <span className="editor__cell-label">
            Source ({masterLocale})
            {entry.source_text ? ' — translated from upload' : ''}
          </span>
          <div className="editor__source">{entry.original_text}</div>
          {entry.source_text ? (
            <span className="field__hint">Original upload: {entry.source_text}</span>
          ) : null}
        </div>
      )}

      <div>
        <span className="editor__cell-label">
          {isMasterView
            ? `Master (${locale})${entry.source_text ? ' — translated from upload' : ''}`
            : `Translation (${locale})`}
        </span>
        {isMasterView && entry.source_text ? (
          <span className="field__hint">Original upload: {entry.source_text}</span>
        ) : null}

        {isMasterView || translation ? (
          <>
            <label className="visually-hidden" htmlFor={`draft_${entry.id}_${locale}`}>
              {isMasterView ? 'Master text' : `Translation for ${locale}`} of {entry.key_name}
            </label>
            <textarea
              id={`draft_${entry.id}_${locale}`}
              className="field__control"
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />

            <div className="btn-row" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--small btn--primary"
                disabled={!isDirty || isSaving}
                onClick={() =>
                  isMasterView
                    ? onSaveMaster(entry.id, draft)
                    : onSaveTranslation(translation.id, draft)
                }
              >
                {isSaving ? 'Saving' : 'Save'}
              </button>
              {isSaved ? <span className="editor__saved">Saved</span> : null}
              {isMasterView && isDirty ? (
                <span className="field__hint" style={{ marginTop: 0 }}>
                  Saving restamps the hash and marks translations stale.
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted">No translation for this language.</p>
        )}
      </div>
    </div>
  );
}
