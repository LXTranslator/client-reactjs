import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { paths } from '../lib/paths.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TextField } from '../components/ui/FormField.jsx';
import { ErrorMessage } from '../components/ui/Feedback.jsx';
import {
  PLACEHOLDERS,
  runValidators,
  validateIdentifier,
  validateTotpCode,
} from '../lib/validation.js';

/**
 * Sign in page.
 *
 * Accepts either a user id or an email address in one field, because asking
 * somebody to remember which one they registered with is needless friction.
 *
 * Two render states, not two routes. An account with a second factor answers a
 * correct password with a challenge rather than a session, and a separate route
 * for that step would sit inside `PublicOnlyRoute` and be redirected away the
 * moment the session existed. Keeping it here also keeps `location.state.from`
 * alive across the step, so somebody who was sent here from a protected page
 * still lands back on it.
 *
 * @returns {JSX.Element} The page.
 */
export function LoginPage() {
  const { login, completeMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /*
   * Held in component state for the life of this form and nowhere else. It is a
   * credential, so it never reaches storage and never reaches a URL.
   */
  const [challengeToken, setChallengeToken] = useState(null);
  const [code, setCode] = useState('');

  /**
   * Updates a field and clears its error as soon as the user edits it.
   *
   * @param {string} field Field name.
   * @returns {Function} Change handler.
   */
  function handleChange(field) {
    return (event) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  /**
   * Validates and submits the form.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const { errors: found, isValid } = runValidators({
      identifier: () => validateIdentifier(values.identifier),
      password: () => (values.password.length === 0 ? 'Enter your password.' : null),
    });

    setErrors(found);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const result = await login({
        identifier: values.identifier.trim(),
        password: values.password,
      });

      if (result.mfaRequired) {
        setChallengeToken(result.challengeToken);
        return;
      }

      finish(result.account);
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Sends the visitor on once a session exists.
   *
   * @param {object} account The signed in account.
   * @returns {void}
   */
  function finish(account) {
    // Return to whatever the visitor was trying to reach before signing in,
    // otherwise their own namespace.
    navigate(location.state?.from ?? paths.namespace(account.user_id), { replace: true });
  }

  /**
   * Answers the second factor challenge.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleChallenge(event) {
    event.preventDefault();
    setSubmitError(null);

    const message = validateTotpCode(code);
    if (message !== null) {
      setErrors({ code: message });
      return;
    }

    setIsSubmitting(true);
    try {
      finish(await completeMfa({ challengeToken, code }));
    } catch (error) {
      setSubmitError(error);
      // A wrong code does not spend the challenge, so the field is simply
      // cleared and they try again.
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__header">
          <span className="eyebrow">LXTranslator</span>
          <h1>{challengeToken !== null ? 'One more step' : 'Welcome back'}</h1>
          <p>
            {challengeToken !== null
              ? 'Enter the code from your authenticator app to finish signing in.'
              : 'Sign in to manage your translation projects.'}
          </p>
        </div>

        <ErrorMessage error={submitError} />

        {challengeToken !== null ? (
          <form onSubmit={handleChallenge} noValidate>
            <TextField
              label="Authentication code"
              name="code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setErrors((current) => ({ ...current, code: undefined }));
              }}
              placeholder={PLACEHOLDERS.totpCode}
              hint="Six digits from your authenticator app, or one of your recovery codes."
              error={errors.code}
              autoComplete="one-time-code"
              inputMode="numeric"
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
                  <span className="spinner" aria-hidden="true" /> Checking
                </>
              ) : (
                'Verify'
              )}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} noValidate>
          <TextField
            label="User id or email"
            name="identifier"
            value={values.identifier}
            onChange={handleChange('identifier')}
            placeholder={PLACEHOLDERS.identifier}
            error={errors.identifier}
            autoComplete="username"
            autoFocus
            required
          />

          <TextField
            label="Password"
            name="password"
            type="password"
            value={values.password}
            onChange={handleChange('password')}
            placeholder="Your password"
            error={errors.password}
            autoComplete="current-password"
            required
          />

          <div className="auth__meta">
            <span />
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" aria-hidden="true" /> Signing in
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
        )}

        <p className="auth__footer">
          Do not have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
