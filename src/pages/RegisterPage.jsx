import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { paths } from '../lib/paths.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAvailability } from '../hooks/useAvailability.js';
import { useForm } from '../hooks/useForm.js';
import { TextField, PasswordField } from '../components/ui/FormField.jsx';
import { AvailabilityHint } from '../components/ui/AvailabilityHint.jsx';
import { ErrorMessage } from '../components/ui/Feedback.jsx';
import {
  PLACEHOLDERS,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateUserId,
} from '../lib/validation.js';

/**
 * Registration page.
 *
 * The user id and email are checked against the API while the visitor types, so
 * a clash surfaces before submitting rather than as a rejection afterwards.
 *
 * @returns {JSX.Element} The page.
 */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const { values, errors, submitError, isSubmitting, handleChange, submit } = useForm({
    user_id: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  // Stable identities so the hook's effect does not re-run every render.
  const validateId = useCallback((candidate) => validateUserId(candidate), []);
  const validateAddress = useCallback((candidate) => validateEmail(candidate), []);

  const idAvailability = useAvailability({
    field: 'user_id',
    value: values.user_id,
    validate: validateId,
  });
  const emailAvailability = useAvailability({
    field: 'email',
    value: values.email,
    validate: validateAddress,
  });

  /**
   * Validates and submits the registration.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();

    // A known clash is treated as a validation failure rather than a submission
    // the server will certainly reject.
    await submit(
      {
        user_id: () =>
          idAvailability === 'taken'
            ? 'That user id is already taken.'
            : validateUserId(values.user_id),
        email: () =>
          emailAvailability === 'taken'
            ? 'That email address is already registered.'
            : validateEmail(values.email),
        password: () => validatePassword(values.password),
        confirm_password: () =>
          validatePasswordConfirmation(values.password, values.confirm_password),
      },
      async () => {
        const account = await register({
          user_id: values.user_id.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
          confirm_password: values.confirm_password,
        });
        navigate(paths.namespace(account.user_id), { replace: true });
      },
    );
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__header">
          <span className="eyebrow">LXTranslator</span>
          <h1>Create your account</h1>
          <p>Your user id becomes your personal namespace.</p>
        </div>

        <ErrorMessage error={submitError} />

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            label="User id"
            name="user_id"
            value={values.user_id}
            onChange={handleChange('user_id')}
            placeholder={PLACEHOLDERS.userId}
            hint="Lowercase letters, digits and underscores. 3 to 32 characters."
            error={errors.user_id}
            autoComplete="username"
            autoFocus
            required
            trailing={<AvailabilityHint state={idAvailability} />}
          />

          <TextField
            label="Email address"
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            placeholder={PLACEHOLDERS.email}
            error={errors.email}
            autoComplete="email"
            required
            trailing={<AvailabilityHint state={emailAvailability} />}
          />

          <PasswordField
            label="Password"
            name="password"
            value={values.password}
            onChange={handleChange('password')}
            placeholder={PLACEHOLDERS.password}
            hint="At least 10 characters, with upper case, lower case and a digit."
            error={errors.password}
            showStrength
            required
          />

          <PasswordField
            label="Confirm password"
            name="confirm_password"
            value={values.confirm_password}
            onChange={handleChange('confirm_password')}
            placeholder="Repeat your password"
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
                <span className="spinner" aria-hidden="true" /> Creating account
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="auth__footer">
          Already have an account? <Link to={paths.login()}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
