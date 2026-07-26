import { useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../ui/Feedback.jsx';
import { validateTranslationFile } from '../../lib/validation.js';

/**
 * The conversation pane: the exchange, and the composer beneath it.
 *
 * Messages are rendered as text. React escapes by default and nothing here
 * reaches for `dangerouslySetInnerHTML`, which matters more than usual on this
 * page: an assistant answer can quote a project name, a locale string or an
 * earlier message, all of which are written by users.
 *
 * @param {object} props Component props.
 * @param {Array<object>} props.turns Exchanges, oldest first.
 * @param {boolean} props.isLoading Whether the history is still arriving.
 * @param {boolean} props.isSending Whether a turn is in flight.
 * @param {Error|null} props.error Failure to render.
 * @param {object|null} props.pending The message awaiting an answer.
 * @param {Function} props.onSend Called with the message and optional file.
 * @returns {JSX.Element} The pane.
 */
export function ChatConversation({ turns, isLoading, isSending, error, pending, onSend }) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

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
   * mistake is caught before a request rather than after one.
   *
   * @param {React.ChangeEvent} event Change event.
   * @returns {void}
   */
  function handleFileChange(event) {
    const selected = event.target.files?.[0] ?? null;
    if (selected === null) {
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
    <section className="chat__pane chat__pane--conversation" aria-label="Conversation">
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
            {turns.map((turn) => (
              <div className="chat__turn" key={turn.id}>
                <ChatMessage role="you" text={turn.user_prompt} />
                <ChatMessage role="assistant" text={turn.ai_answer} />
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
                    setFile(null);
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
            Enter sends, Shift and Enter start a new line. A JSON locale file lets the
            assistant create a project from it.
          </span>
        )}
      </form>
    </section>
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
