import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/apiClient.js';
import { TextField } from '../components/ui/FormField.jsx';
import { Callout, ErrorMessage } from '../components/ui/Feedback.jsx';
import { PLACEHOLDERS, validateEmail } from '../lib/validation.js';

/**
 * Forgot password page.
 *
 * The confirmation is deliberately identical whether or not the address has an
 * account, matching the server. Saying "no account with that address" here
 * would turn the page into a way to test which addresses are registered.
 *
 * @returns {JSX.Element} The page.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validates and submits the request.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const message = validateEmail(email);
    setError(message);
    if (message !== null) return;

    setIsSubmitting(true);
    try {
      const response = await api.forgotPassword({ email: email.trim().toLowerCase() });
      setResult(response);
    } catch (caught) {
      setSubmitError(caught);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__header">
          <span className="eyebrow">Account recovery</span>
          <h1>Forgot your password?</h1>
          <p>We will send a reset link that expires in 10 minutes.</p>
        </div>

        <ErrorMessage error={submitError} />

        {result === null ? (
          <form onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email address"
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              placeholder={PLACEHOLDERS.email}
              error={error}
              autoComplete="email"
              autoFocus
              required
            />

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Sending
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>
        ) : (
          <>
            <Callout tone="ok" title="Check your inbox">
              {result.message}
            </Callout>

            {/*
              The API returns this token outside production only, so the flow
              can be completed locally without a mail server. It is absent in a
              production build.
            */}
            {result.development_token ? (
              <Callout tone="warn" title="Development mode">
                Mail delivery is not configured, so the token is shown here.
                <div style={{ marginTop: '0.6rem' }}>
                  <Link
                    className="btn btn--small"
                    to={`/reset-password?token=${encodeURIComponent(result.development_token)}`}
                  >
                    Continue to reset
                  </Link>
                </div>
              </Callout>
            ) : null}
          </>
        )}

        <p className="auth__footer">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
