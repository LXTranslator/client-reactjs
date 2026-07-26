import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/apiClient.js';
import { PasswordField, TextField } from '../components/ui/FormField.jsx';
import { Callout, ErrorMessage } from '../components/ui/Feedback.jsx';
import {
  runValidators,
  validatePassword,
  validatePasswordConfirmation,
} from '../lib/validation.js';

/**
 * Reset password page.
 *
 * The token normally arrives in the query string from the emailed link. A
 * manual field is offered as a fallback for a mail client that mangles the URL.
 *
 * @returns {JSX.Element} The page.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    token: searchParams.get('token') ?? '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isDone, setIsDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasTokenFromLink = searchParams.get('token') !== null;

  /**
   * Updates a field and clears its error.
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
   * Validates and submits the reset.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const { errors: found, isValid } = runValidators({
      token: () => (values.token.trim().length === 0 ? 'The reset token is missing.' : null),
      password: () => validatePassword(values.password),
      confirm_password: () =>
        validatePasswordConfirmation(values.password, values.confirm_password),
    });

    setErrors(found);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await api.resetPassword({
        token: values.token.trim(),
        password: values.password,
        confirm_password: values.confirm_password,
      });
      setIsDone(true);
      // A short pause so the confirmation is actually read before redirecting.
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__header">
          <span className="eyebrow">Account recovery</span>
          <h1>Choose a new password</h1>
          <p>Reset links expire 10 minutes after they are issued and work only once.</p>
        </div>

        {isDone ? (
          <Callout tone="ok" title="Password updated">
            Taking you to the sign in page.
          </Callout>
        ) : (
          <>
            <ErrorMessage error={submitError} />

            <form onSubmit={handleSubmit} noValidate>
              {hasTokenFromLink ? null : (
                <TextField
                  label="Reset token"
                  name="token"
                  value={values.token}
                  onChange={handleChange('token')}
                  placeholder="Paste the token from your email"
                  hint="Normally filled in automatically by the link in your email."
                  error={errors.token}
                  required
                />
              )}

              <PasswordField
                label="New password"
                name="password"
                value={values.password}
                onChange={handleChange('password')}
                placeholder="At least 10 characters"
                hint="At least 10 characters, with upper case, lower case and a digit."
                error={errors.password}
                showStrength
                autoFocus
                required
              />

              <PasswordField
                label="Confirm new password"
                name="confirm_password"
                value={values.confirm_password}
                onChange={handleChange('confirm_password')}
                placeholder="Repeat your new password"
                error={errors.confirm_password}
                required
              />

              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Updating
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </form>
          </>
        )}

        <p className="auth__footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
