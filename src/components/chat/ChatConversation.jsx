import { useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../ui/Feedback.jsx';
import { validateTranslationFile } from '../../lib/validation.js';
import { api } from '../../lib/apiClient.js';
import { triggerDownload } from '../../lib/download.js';

/**
 * The conversation pane: the exchange, and the composer beneath it.
 *
 * Messages are rendered as text. React escapes by default and nothing here
 * reaches for `dangerouslySetInnerHTML`, which matters more than usual on this
 * page: an assistant answer can quote a project name, a locale string or an
 * earlier message, all of which are written by users.
 *
 * A file can be dropped anywhere on the pane as well as chosen through the
 * button. Dropping is how people arrive at a chat holding a file, and it goes
 * through exactly the same check the button does, because a dropped file is no
 * more trustworthy than a chosen one.
 *
 * An answer may also come back offering downloads. Those are rendered as
 * buttons beneath it, because a file is the thing being asked for and a
 * sentence describing where to find one is not an answer to that.
 *
 * @param {object} props Component props.
 * @param {Array<object>} props.turns Exchanges, oldest first.
 * @param {boolean} props.isLoading Whether the history is still arriving.
 * @param {boolean} props.isSending Whether a turn is in flight.
 * @param {Error|null} props.error Failure to render.
 * @param {object|null} props.pending The message awaiting an answer.
 * @param {Array<object>} [props.downloads] What the newest answer offers.
 * @param {Function} props.onSend Called with the message and optional file.
 * @returns {JSX.Element} The pane.
 */
export function ChatConversation({
  turns,
  isLoading,
  isSending,
  error,
  pending,
  downloads = [],
  onSend,
}) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  /*
   * Drag events fire on every child the pointer crosses, so a plain
   * enter/leave pair flickers the whole way across the pane. Counting them
   * makes leaving the pane the only thing that clears the highlight.
   */
  const dragDepth = useRef(0);

  /*
   * Keep the newest exchange in view as the conversation grows.
   *
   * Called through an optional call rather than plainly: scrolling is a
   * convenience, and an environment that does not implement it must not take
   * the conversation down with it.
   */
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [turns.length, pending, isSending]);

  /**
   * Attaches a file after the same checks an upload gets.
   *
   * The server verifies the bytes regardless; this is here so an obvious
   * mistake is caught before a request rather than after one. Both the button
   * and the drop target come through here, so neither can be the lenient one.
   *
   * @param {File|null} selected The file, or null to clear.
   * @returns {void}
   */
  function attach(selected) {
    if (selected === null || selected === undefined) {
      setFile(null);
      setFileError(null);
      return;
    }

    const problem = validateTranslationFile(selected);
    if (problem !== null) {
      setFile(null);
      setFileError(problem);
      return;
    }

    setFile(selected);
    setFileError(null);
  }

  /**
   * Attaches the file chosen through the button.
   *
   * @param {React.ChangeEvent} event Change event.
   * @returns {void}
   */
  function handleFileChange(event) {
    attach(event.target.files?.[0] ?? null);
  }

  /**
   * Keeps the browser from navigating away to the dropped file.
   *
   * Without this, dropping a JSON file on a page replaces the page with it,
   * which is the browser default and is never what somebody meant.
   *
   * @param {React.DragEvent} event Drag event.
   * @returns {void}
   */
  function handleDragOver(event) {
    event.preventDefault();
  }

  /**
   * Lights up the pane while a file is over it.
   *
   * @param {React.DragEvent} event Drag event.
   * @returns {void}
   */
  function handleDragEnter(event) {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDropTarget(true);
  }

  /**
   * Clears the highlight once the pointer has actually left the pane.
   *
   * @returns {void}
   */
  function handleDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDropTarget(false);
  }

  /**
   * Attaches a dropped file.
   *
   * One file, because the assistant takes one attachment per turn. Dropping
   * several attaches the first and says so, rather than silently ignoring the
   * rest or refusing the lot.
   *
   * @param {React.DragEvent} event Drop event.
   * @returns {void}
   */
  function handleDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDropTarget(false);

    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length === 0) return;

    attach(dropped[0]);

    if (dropped.length > 1) {
      setFileError('One file per message. The first one was attached.');
    }
  }

  /**
   * Sends the message.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    if (message.trim().length === 0 || isSending) return;

    const sent = message;
    const attachment = file;

    setMessage('');
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    await onSend(sent.trim(), attachment);
  }

  /**
   * Sends on Enter, leaving Shift and Enter for a new line.
   *
   * @param {React.KeyboardEvent} event Key event.
   * @returns {void}
   */
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section
      className={`chat__pane chat__pane--conversation${
        isDropTarget ? ' chat__pane--dropping' : ''
      }`}
      aria-label="Conversation"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDropTarget ? (
        <div className="chat__dropzone" aria-hidden="true">
          Drop a JSON locale file to attach it
        </div>
      ) : null}

      <div className="chat__messages">
        {isLoading ? (
          <LoadingState label="Loading conversation" />
        ) : turns.length === 0 && pending === null ? (
          <EmptyState title="Ask the assistant something.">
            <p className="muted">
              It can list your projects, check which languages a project has, add languages
              across several projects at once, and put a file you attach into a new project
              or one you already have.
            </p>
          </EmptyState>
        ) : (
          <>
            {turns.map((turn, index) => (
              <div className="chat__turn" key={turn.id}>
                <ChatMessage role="you" text={turn.user_prompt} />
                <ChatMessage role="assistant" text={turn.ai_answer} />
                {/*
                 * Only under the newest answer, because that is the one the
                 * offers belong to. The server sends them with the reply rather
                 * than storing them on the exchange, so an older turn scrolled
                 * back to has none and must not borrow these.
                 */}
                {index === turns.length - 1 ? <ChatDownloads downloads={downloads} /> : null}
              </div>
            ))}

            {pending !== null ? (
              <div className="chat__turn">
                <ChatMessage role="you" text={pending.message} />
                {isSending ? (
                  <div className="chat__message chat__message--assistant">
                    <span className="chat__message-role">Assistant</span>
                    <p className="chat__message-body muted">
                      <span className="spinner" aria-hidden="true" /> Thinking
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        <div ref={endRef} />
      </div>

      <ErrorMessage error={error} />

      <form className="chat__composer" onSubmit={handleSubmit} noValidate>
        <label className="visually-hidden" htmlFor="chat_message">
          Message
        </label>
        <textarea
          id="chat_message"
          className="field__control chat__input"
          rows={3}
          value={message}
          placeholder="Ask about your projects, or attach a locale file to start one"
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="chat__composer-row">
          <div className="chat__attach">
            <label className="btn btn--small" htmlFor="chat_file">
              {file ? 'Change file' : 'Attach a file'}
            </label>
            <input
              id="chat_file"
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <span className="chat__attachment">
                <span className="mono">{file.name}</span>
                <button
                  type="button"
                  className="chat__session-forget"
                  onClick={() => {
                    attach(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </span>
            ) : null}
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSending || message.trim().length === 0}
          >
            {isSending ? 'Sending' : 'Send'}
          </button>
        </div>

        {fileError ? (
          <span className="field__error" role="alert">
            {fileError}
          </span>
        ) : (
          <span className="field__hint">
            Enter sends, Shift and Enter start a new line. Attach a JSON locale file, or
            drop one anywhere on this pane, and the assistant can put it into a new project
            or one you already have.
          </span>
        )}
      </form>
    </section>
  );
}

/**
 * The downloads an answer is offering.
 *
 * Each offer is a reference the server built: which file, which locale, which
 * format, and what to save it as. The bytes are fetched here, through the
 * authenticated client, exactly as the editor fetches them. That is what makes
 * this safe to render from a chat answer: the download endpoint resolves access
 * for the person clicking, so an offer cannot reach a file they could not have
 * downloaded from the editor themselves.
 *
 * A failure is shown here rather than thrown away, because the button is the
 * whole point of the answer above it.
 *
 * @param {object} props Component props.
 * @param {Array<object>} props.downloads Offers from the newest answer.
 * @returns {JSX.Element|null} The controls, or nothing when there are none.
 */
function ChatDownloads({ downloads }) {
  const [busyFilename, setBusyFilename] = useState(null);
  const [error, setError] = useState(null);

  if (downloads.length === 0) return null;

  /**
   * Fetches one offer and hands it to the browser.
   *
   * @param {object} offer What the answer offered.
   * @returns {Promise<void>}
   */
  async function handleDownload(offer) {
    setError(null);
    setBusyFilename(offer.filename);
    try {
      // The server already wrote the document in the chosen format, so what
      // arrived is what is saved rather than something parsed and rebuilt.
      const blob =
        offer.lang === null
          ? await api.downloadArchive(offer.file_id, offer.export_format)
          : await api.downloadLocale(offer.file_id, offer.lang, offer.export_format);

      triggerDownload(offer.filename, blob);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusyFilename(null);
    }
  }

  return (
    <div className="chat__downloads">
      {downloads.map((offer) => (
        <button
          key={`${offer.file_id}_${offer.lang ?? 'all'}_${offer.export_format}`}
          type="button"
          className="btn btn--small btn--primary"
          onClick={() => handleDownload(offer)}
          disabled={busyFilename !== null}
        >
          {busyFilename === offer.filename ? 'Preparing' : `Download ${offer.filename}`}
        </button>
      ))}

      <span className="chat__downloads-note muted">
        {downloads.length === 1 && downloads[0].lang === null
          ? `${downloads[0].langs.length} languages, written in ${downloads[0].format_name}`
          : `Written in ${downloads[0].format_name}`}
      </span>

      <ErrorMessage error={error} />
    </div>
  );
}

/**
 * One message.
 *
 * @param {object} props Component props.
 * @param {'you'|'assistant'} props.role Who wrote it.
 * @param {string} props.text The message.
 * @returns {JSX.Element} The message.
 */
function ChatMessage({ role, text }) {
  return (
    <div className={`chat__message chat__message--${role}`}>
      <span className="chat__message-role">{role === 'you' ? 'You' : 'Assistant'}</span>
      {/* Rendered as text, never as markup. */}
      <p className="chat__message-body">{text}</p>
    </div>
  );
}
