import { useRef, useState } from 'react';
import { api } from '../../lib/apiClient.js';
import { MAX_UPLOAD_BYTES } from '../../lib/locales.js';
import { LocalePicker } from '../ui/LocalePicker.jsx';
import { validateTranslationFile } from '../../lib/validation.js';
import { Callout, ErrorMessage } from '../ui/Feedback.jsx';

/**
 * Labels the add button with the number of languages chosen.
 *
 * @param {number} count How many are selected.
 * @returns {string} Button label.
 */
function addLabel(count) {
  if (count === 0) return 'Add languages';
  return count === 1 ? 'Add 1 language' : `Add ${count} languages`;
}

/**
 * Controls for growing a file after it exists: more languages, more keys.
 *
 * Both actions return 202 and finish on a worker thread, so neither reports a
 * result directly. They hand back to the page, which polls the file's status
 * exactly as it does after an upload.
 *
 * @param {object} props Component props.
 * @param {string} props.fileId File being extended.
 * @param {string[]} props.existingLocales Locales the file already carries.
 * @param {Function} props.onStarted Called once work has been accepted.
 * @returns {JSX.Element} The panel.
 */
export function FileGrowthPanel({ fileId, existingLocales, onStarted }) {
  const [selected, setSelected] = useState([]);
  const [languageError, setLanguageError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const [droppedFile, setDroppedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mergeError, setMergeError] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [notice, setNotice] = useState(null);
  const inputRef = useRef(null);

  const held = new Set(existingLocales);

  /**
   * Adds or removes a locale from the pending selection.
   *
   * @param {string} code Locale code.
   * @returns {void}
   */
  function toggleLocale(code) {
    setLanguageError(null);
    setSelected((current) =>
      current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code],
    );
  }

  /**
   * Sends the selected languages to the server.
   *
   * @returns {Promise<void>}
   */
  async function handleAddLanguages() {
    if (selected.length === 0) {
      setLanguageError(new Error('Choose at least one language to add.'));
      return;
    }

    setLanguageError(null);
    setNotice(null);
    setIsAdding(true);
    try {
      const result = await api.addFileLanguages(fileId, { target_langs: selected });
      setSelected([]);
      setNotice(
        `Translating the existing keys into ${(result?.added ?? selected).join(', ')}. ` +
          'Languages already on the file are left as they are.',
      );
      onStarted();
    } catch (error) {
      setLanguageError(error);
    } finally {
      setIsAdding(false);
    }
  }

  /**
   * Accepts a dropped or chosen file after the same checks the upload page runs.
   *
   * @param {File|null} candidate The file.
   * @returns {void}
   */
  function acceptFile(candidate) {
    if (candidate === null) return;

    const message = validateTranslationFile(candidate, { maxBytes: MAX_UPLOAD_BYTES });
    if (message !== null) {
      setMergeError(new Error(message));
      setDroppedFile(null);
      return;
    }

    setMergeError(null);
    setDroppedFile(candidate);
  }

  /**
   * Sends the dropped document to be merged.
   *
   * @returns {Promise<void>}
   */
  async function handleMerge() {
    if (droppedFile === null) {
      setMergeError(new Error('Choose a file to merge.'));
      return;
    }

    setMergeError(null);
    setNotice(null);
    setIsMerging(true);
    try {
      const formData = new FormData();
      formData.append('file', droppedFile);

      const result = await api.mergeFileKeys(fileId, formData);
      setDroppedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setNotice(
        `Merging. Keys this file already has are skipped, including the ${
          result?.existing_key_count ?? 0
        } it holds now, so only new keys are translated.`,
      );
      onStarted();
    } catch (error) {
      setMergeError(error);
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Add to this file</h2>
      </div>

      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <div className="field">
        <LocalePicker
          selected={selected}
          exclude={existingLocales}
          onToggle={toggleLocale}
          label="Languages"
          hint="Existing keys are translated into the new languages only. Languages already here are never retranslated, so reviewed work is left alone."
        />

        <ErrorMessage error={languageError} />

        <div className="btn-row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={isAdding || selected.length === 0}
            onClick={handleAddLanguages}
          >
            {isAdding ? 'Adding…' : addLabel(selected.length)}
          </button>
        </div>
      </div>

      <div className="field" style={{ marginTop: '1.5rem' }}>
        <span className="field__label">Keys</span>
        <p className="muted" style={{ marginTop: 0 }}>
          Drop a locale document to add the keys this file does not have yet. A key it
          already holds is skipped whole, so translations and your corrections survive even
          if the document has a different value for them.
        </p>

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
            {droppedFile ? 'File selected' : 'Choose a file or drop it here'}
          </span>
          {droppedFile ? (
            <span className="dropzone__file">
              {droppedFile.name} ({Math.ceil(droppedFile.size / 1024)} KB)
            </span>
          ) : (
            <span className="dropzone__hint">
              A .json locale file, up to {Math.floor(MAX_UPLOAD_BYTES / 1024)} KB
            </span>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label="Locale document to merge"
          onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
        />

        <ErrorMessage error={mergeError} />

        <div className="btn-row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={isMerging || droppedFile === null}
            onClick={handleMerge}
          >
            {isMerging ? 'Merging…' : 'Merge new keys'}
          </button>
          {droppedFile ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDroppedFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
