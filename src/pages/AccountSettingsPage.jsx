import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/apiClient.js';
import { PasswordField, TextField, TextAreaField } from '../components/ui/FormField.jsx';
import { Callout, ErrorMessage } from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import {
  PLACEHOLDERS,
  runValidators,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateUserId,
  validateWebsiteUrl,
} from '../lib/validation.js';

/**
 * Account settings.
 *
 * Sensitive changes follow the server's two step flow: confirm the current
 * password to mint a ten minute single use token, then spend it on exactly one
 * change. The token is held in component state only, never stored, and is
 * discarded as soon as it is spent.
 *
 * Display fields need no token, since none of them can be used to take over the
 * account.
 *
 * @returns {JSX.Element} The page.
 */
export function AccountSettingsPage() {
  const { account, refresh, logout } = useAuth();

  const [password, setPassword] = useState('');
  const [settingsToken, setSettingsToken] = useState(null);
  const [confirmError, setConfirmError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [errors, setErrors] = useState({});
  const [isConfirming, setIsConfirming] = useState(false);

  const [values, setValues] = useState({
    user_id: account?.user_id ?? '',
    email: account?.email ?? '',
    new_password: '',
    confirm_new_password: '',
  });

  const [profile, setProfile] = useState({
    display_name: account?.display_name ?? '',
    description: account?.description ?? '',
    website_url: account?.website_url ?? '',
  });

  /**
   * Exchanges the current password for a settings token.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleConfirmPassword(event) {
    event.preventDefault();
    setConfirmError(null);
    setNotice(null);

    if (password.length === 0) {
      setConfirmError(new Error('Enter your current password.'));
      return;
    }

    setIsConfirming(true);
    try {
      const result = await api.confirmPassword({ password });
      setSettingsToken(result.token);
      setPassword('');
      setNotice(
        `Confirmed. You have ${Math.round(result.expires_in / 60)} minutes to make one change.`,
      );
    } catch (error) {
      setConfirmError(error);
    } finally {
      setIsConfirming(false);
    }
  }

  /**
   * Runs one token backed change and discards the token afterwards.
   *
   * The token is single use on the server, so keeping it in state after
   * spending it would only produce a confusing second failure.
   *
   * @param {Function} action Receives the token and performs the change.
   * @param {string} successMessage Confirmation to show.
   * @returns {Promise<void>}
   */
  async function runTokenAction(action, successMessage) {
    setActionError(null);
    setNotice(null);

    if (settingsToken === null) {
      setActionError(new Error('Confirm your password first.'));
      return;
    }

    try {
      await action(settingsToken);
      setSettingsToken(null);
      setNotice(successMessage);
      await refresh();
    } catch (error) {
      setActionError(error);
      // A spent or expired token cannot be reused, so clear it and make the
      // visitor confirm again.
      if (error?.status === 401) setSettingsToken(null);
    }
  }

  /**
   * Changes the routing user id.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleUserIdChange(event) {
    event.preventDefault();

    const { errors: found, isValid } = runValidators({
      user_id: () => validateUserId(values.user_id),
    });
    setErrors(found);
    if (!isValid) return;

    await runTokenAction(
      (token) => api.updateUserId({ token, user_id: values.user_id.trim() }),
      'Your user id has been updated.',
    );
  }

  /**
   * Changes the email address.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleEmailChange(event) {
    event.preventDefault();

    const { errors: found, isValid } = runValidators({
      email: () => validateEmail(values.email),
    });
    setErrors(found);
    if (!isValid) return;

    await runTokenAction(
      (token) => api.updateEmail({ token, email: values.email.trim().toLowerCase() }),
      'Your email address has been updated.',
    );
  }

  /**
   * Changes the password, then signs out so the new one is used next time.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handlePasswordChange(event) {
    event.preventDefault();

    const { errors: found, isValid } = runValidators({
      new_password: () => validatePassword(values.new_password),
      confirm_new_password: () =>
        validatePasswordConfirmation(values.new_password, values.confirm_new_password),
    });
    setErrors(found);
    if (!isValid) return;

    await runTokenAction(async (token) => {
      await api.updatePassword({
        token,
        password: values.new_password,
        confirm_password: values.confirm_new_password,
      });
      // Changing the password invalidates other outstanding tokens server side,
      // so the cleanest end state is a fresh sign in.
      logout();
    }, 'Your password has been updated. Sign in again.');
  }

  /**
   * Saves display fields, which need no confirmation token.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleProfileSave(event) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    const { errors: found, isValid } = runValidators({
      website_url: () => validateWebsiteUrl(profile.website_url),
    });
    setErrors(found);
    if (!isValid) return;

    try {
      await api.updateProfile({
        display_name: profile.display_name.trim(),
        description: profile.description.trim(),
        ...(profile.website_url.trim() ? { website_url: profile.website_url.trim() } : {}),
      });
      setNotice('Profile saved.');
      await refresh();
    } catch (error) {
      setActionError(error);
    }
  }

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[{ label: 'Namespaces', to: '/namespaces' }, { label: 'Account settings' }]}
      />

      <h1>Account settings</h1>
      <p className="lead">
        Signed in as <span className="mono">{account?.user_id}</span>.
      </p>

      {notice ? <Callout tone="ok">{notice}</Callout> : null}
      <ErrorMessage error={actionError} />

      <section className="panel">
        <div className="panel__header">
          <h2>Profile</h2>
        </div>

        <form onSubmit={handleProfileSave} noValidate>
          <TextField
            label="Display name"
            name="display_name"
            value={profile.display_name}
            onChange={(event) =>
              setProfile((current) => ({ ...current, display_name: event.target.value }))
            }
            placeholder="Jetsada Wijit"
          />

          <TextAreaField
            label="Description"
            name="description"
            value={profile.description}
            onChange={(event) =>
              setProfile((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Localization engineer"
          />

          <TextField
            label="Website"
            name="website_url"
            type="url"
            value={profile.website_url}
            onChange={(event) =>
              setProfile((current) => ({ ...current, website_url: event.target.value }))
            }
            placeholder={PLACEHOLDERS.websiteUrl}
            error={errors.website_url}
          />

          <button type="submit" className="btn btn--primary">
            Save profile
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Security confirmation</h2>
          {settingsToken ? <span className="badge badge--ok">Confirmed</span> : null}
        </div>

        <Callout tone="info" title="Why this is needed">
          Changing your user id, email address or password requires re-entering your
          current password. That mints a token valid for 10 minutes and usable exactly
          once, so an unattended session cannot be used to take over the account.
        </Callout>

        <ErrorMessage error={confirmError} />

        <form onSubmit={handleConfirmPassword} noValidate>
          <TextField
            label="Current password"
            name="current_password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your current password"
            autoComplete="current-password"
            disabled={settingsToken !== null}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={isConfirming || settingsToken !== null}
          >
            {isConfirming ? 'Confirming' : settingsToken ? 'Confirmed' : 'Confirm password'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>User id</h2>
        </div>

        <form onSubmit={handleUserIdChange} noValidate>
          <TextField
            label="User id"
            name="user_id"
            value={values.user_id}
            onChange={(event) => {
              setValues((current) => ({ ...current, user_id: event.target.value }));
              setErrors((current) => ({ ...current, user_id: undefined }));
            }}
            placeholder={PLACEHOLDERS.userId}
            hint="This is your personal namespace, and it appears in URLs."
            error={errors.user_id}
          />

          <button type="submit" className="btn" disabled={settingsToken === null}>
            Update user id
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Email address</h2>
        </div>

        <form onSubmit={handleEmailChange} noValidate>
          <TextField
            label="Email address"
            name="email"
            type="email"
            value={values.email}
            onChange={(event) => {
              setValues((current) => ({ ...current, email: event.target.value }));
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder={PLACEHOLDERS.email}
            hint="Used for sign in and password recovery."
            error={errors.email}
          />

          <button type="submit" className="btn" disabled={settingsToken === null}>
            Update email
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Password</h2>
        </div>

        <form onSubmit={handlePasswordChange} noValidate>
          <PasswordField
            label="New password"
            name="new_password"
            value={values.new_password}
            onChange={(event) => {
              setValues((current) => ({ ...current, new_password: event.target.value }));
              setErrors((current) => ({ ...current, new_password: undefined }));
            }}
            placeholder="At least 10 characters"
            error={errors.new_password}
            showStrength
          />

          <PasswordField
            label="Confirm new password"
            name="confirm_new_password"
            value={values.confirm_new_password}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                confirm_new_password: event.target.value,
              }));
              setErrors((current) => ({ ...current, confirm_new_password: undefined }));
            }}
            placeholder="Repeat your new password"
            error={errors.confirm_new_password}
          />

          <button type="submit" className="btn" disabled={settingsToken === null}>
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}
