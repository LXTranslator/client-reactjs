import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../lib/apiClient.js';
import { SelectField, TextField } from '../components/ui/FormField.jsx';
import { Callout, ErrorMessage } from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { validateLangCode, validateTranslationFile } from '../lib/validation.js';

/**
 * Locales offered as chips.
 *
 * A shortlist rather than every possible locale, because a long list is harder
 * to use than a short one plus a free text field for anything missing.
 */
const COMMON_LOCALES = [
  { code: 'en_us', label: 'English (US)' },
  { code: 'th_th', label: 'Thai' },
  { code: 'ja_jp', label: 'Japanese' },
  { code: 'ko_kr', label: 'Korean' },
  { code: 'zh_cn', label: 'Chinese (Simplified)' },
  { code: 'fr_fr', label: 'French' },
  { code: 'de_de', label: 'German' },
  { code: 'es_es', label: 'Spanish' },
  { code: 'pt_br', label: 'Portuguese (Brazil)' },
  { code: 'vi_vn', label: 'Vietnamese' },
];

/** Mirrors the server's default ceiling. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * File upload page.
 *
 * Validates the chosen file before it is sent, which turns an obviously wrong
 * upload into instant feedback rather than a round trip. The server repeats
 * every one of these checks and adds content verification, so this is purely
 * for responsiveness.
 *
 * @returns {JSX.Element} The page.
 */
export function ProjectUploadsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [sourceLang, setSourceLang] = useState('en_us');
  const [targetLangs, setTargetLangs] = useState(['th_th']);
  const [customLang, setCustomLang] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Accepts a chosen file after local validation.
   *
   * @param {File|null} candidate Selected file.
   * @returns {void}
   */
  function acceptFile(candidate) {
    const message = validateTranslationFile(candidate, { maxBytes: MAX_UPLOAD_BYTES });
    setErrors((current) => ({ ...current, file: message ?? undefined }));
    setFile(message === null ? candidate : null);
  }

  /**
   * Toggles a target locale.
   *
   * @param {string} code Locale code.
   * @returns {void}
   */
  function toggleTarget(code) {
    setErrors((current) => ({ ...current, target_langs: undefined }));
    setTargetLangs((current) =>
      current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code],
    );
  }

  /**
   * Adds a locale that is not in the shortlist.
   *
   * @returns {void}
   */
  function addCustomLang() {
    const candidate = customLang.trim().toLowerCase();
    const message = validateLangCode(candidate);

    if (message !== null) {
      setErrors((current) => ({ ...current, custom_lang: message }));
      return;
    }
    if (targetLangs.includes(candidate)) {
      setErrors((current) => ({ ...current, custom_lang: 'That language is already selected.' }));
      return;
    }

    setTargetLangs((current) => [...current, candidate]);
    setCustomLang('');
    setErrors((current) => ({ ...current, custom_lang: undefined, target_langs: undefined }));
  }

  /**
   * Uploads the file.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const found = {};
    const fileMessage = validateTranslationFile(file, { maxBytes: MAX_UPLOAD_BYTES });
    if (fileMessage !== null) found.file = fileMessage;

    const effectiveTargets = targetLangs.filter((code) => code !== sourceLang);
    if (effectiveTargets.length === 0) {
      found.target_langs = 'Select at least one target language that differs from the source.';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source_lang', sourceLang);
      formData.append('target_langs', JSON.stringify(effectiveTargets));

      const result = await api.uploadFile(projectId, formData);
      navigate(`/namespaces/project/${projectId}/file/${result.file.id}`);
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsUploading(false);
    }
  }

  const effectiveTargets = targetLangs.filter((code) => code !== sourceLang);

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: '/namespaces' },
          { label: 'Projects', to: '/namespaces/projects' },
          { label: 'Project', to: `/namespaces/project/${projectId}` },
          { label: 'Upload' },
        ]}
      />

      <h1>Upload a translation file</h1>
      <p className="lead">
        Upload a JSON locale file. If it is not English it is translated into{' '}
        <span className="mono">en_us</span> first, and every target language is derived
        from that master.
      </p>

      <Callout tone="info" title="What is accepted">
        JSON files only, up to {Math.floor(MAX_UPLOAD_BYTES / 1024)} KB, containing a JSON
        object at the root. Filenames are sanitised and the contents are verified on the
        server before anything is stored.
      </Callout>

      <ErrorMessage error={submitError} />

      <form onSubmit={handleSubmit} noValidate>
        <section className="panel">
          <div className="panel__header">
            <h2>File</h2>
          </div>

          <div
            className={`dropzone${isDragging ? ' is-dragging' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              acceptFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <span className="dropzone__title">
              {file ? 'File selected' : 'Choose a file or drop it here'}
            </span>
            {file ? (
              <span className="dropzone__file">
                {file.name} ({Math.ceil(file.size / 1024)} KB)
              </span>
            ) : (
              <span className="dropzone__hint">
                A .json locale file, for example en_us.json
              </span>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            aria-label="Translation file"
            onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
          />

          {errors.file ? (
            <span className="field__error" role="alert" style={{ marginTop: '0.5rem' }}>
              {errors.file}
            </span>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Languages</h2>
          </div>

          <SelectField
            label="Source language"
            name="source_lang"
            value={sourceLang}
            onChange={(event) => setSourceLang(event.target.value)}
            options={COMMON_LOCALES.map((locale) => ({
              value: locale.code,
              label: `${locale.label} (${locale.code})`,
            }))}
            hint="The language the uploaded file is written in."
          />

          <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
            <legend className="field__label" style={{ padding: 0 }}>
              Target languages
              <span className="field__required" aria-hidden="true">
                *
              </span>
            </legend>

            <div className="chip-row">
              {COMMON_LOCALES.filter((locale) => locale.code !== sourceLang).map((locale) => {
                const isSelected = targetLangs.includes(locale.code);
                return (
                  <button
                    key={locale.code}
                    type="button"
                    className={`chip${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleTarget(locale.code)}
                  >
                    {locale.label}
                    <span className="mono" style={{ fontSize: '0.75em' }}>
                      {locale.code}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Any locale outside the shortlist. */}
            {effectiveTargets.filter(
              (code) => !COMMON_LOCALES.some((locale) => locale.code === code),
            ).length > 0 ? (
              <div className="chip-row" style={{ marginTop: '0.5rem' }}>
                {effectiveTargets
                  .filter((code) => !COMMON_LOCALES.some((locale) => locale.code === code))
                  .map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="chip is-selected"
                      aria-pressed="true"
                      onClick={() => toggleTarget(code)}
                    >
                      <span className="mono">{code}</span> ✕
                    </button>
                  ))}
              </div>
            ) : null}

            {errors.target_langs ? (
              <span className="field__error" role="alert" style={{ marginTop: '0.5rem' }}>
                {errors.target_langs}
              </span>
            ) : null}
          </fieldset>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <TextField
                label="Add another language"
                name="custom_lang"
                value={customLang}
                onChange={(event) => {
                  setCustomLang(event.target.value);
                  setErrors((current) => ({ ...current, custom_lang: undefined }));
                }}
                placeholder="id_id"
                hint="A locale code such as id_id or nl_nl."
                error={errors.custom_lang}
              />
            </div>
            <button
              type="button"
              className="btn"
              style={{ marginTop: '1.85rem' }}
              onClick={addCustomLang}
            >
              Add
            </button>
          </div>

          <p className="muted" style={{ marginBottom: 0 }}>
            Selected: {effectiveTargets.length === 0 ? 'none' : effectiveTargets.join(', ')}
          </p>
        </section>

        <div className="btn-row">
          <button type="submit" className="btn btn--primary" disabled={isUploading}>
            {isUploading ? (
              <>
                <span className="spinner" aria-hidden="true" /> Uploading
              </>
            ) : (
              'Upload and translate'
            )}
          </button>
          <Link className="btn btn--ghost" to={`/namespaces/project/${projectId}`}>
            Cancel
          </Link>
        </div>

        {isUploading ? (
          <div className="progress" style={{ marginTop: '1rem' }}>
            {/* Indeterminate: the server processes after the response returns. */}
            <div className="progress__fill" style={{ width: '100%', opacity: 0.6 }} />
          </div>
        ) : null}
      </form>
    </div>
  );
}
