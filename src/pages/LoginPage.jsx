import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { TextField } from '../components/ui/FormField.jsx';
import { ErrorMessage } from '../components/ui/Feedback.jsx';
import { PLACEHOLDERS, runValidators, validateIdentifier } from '../lib/validation.js';

/**
 * Sign in page.
 *
 * Accepts either a user id or an email address in one field, because asking
 * somebody to remember which one they registered with is needless friction.
 *
 * @returns {JSX.Element} The page.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await login({
        identifier: values.identifier.trim(),
        password: values.password,
      });
      // Return to whatever the visitor was trying to reach before signing in.
      navigate(location.state?.from ?? '/namespaces', { replace: true });
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
          <span className="eyebrow">LXTranslator</span>
          <h1>Welcome back</h1>
          <p>Sign in to manage your translation projects.</p>
        </div>

        <ErrorMessage error={submitError} />

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

        <p className="auth__footer">
          Do not have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
