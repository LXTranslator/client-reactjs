import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { QrCode } from '../components/ui/QrCode.jsx';
import { TextField } from '../components/ui/FormField.jsx';
import { Callout, ErrorMessage, LoadingState } from '../components/ui/Feedback.jsx';
import { api } from '../lib/apiClient.js';
import { paths } from '../lib/paths.js';
import { PLACEHOLDERS, validateTotpCode } from '../lib/validation.js';

/**
 * Manages the account's second factor.
 *
 * Three things on this page are shown exactly once and never again: the secret,
 * its QR code, and the recovery codes. They are held in component state until
 * the person dismisses them rather than in a notice that clears itself, because
 * a credential that vanishes on a timer is a credential somebody loses.
 *
 * Every change goes through a settings token, the same single use confirmation
 * a password change takes. Turning a second factor off is exactly as sensitive
 * as turning it on.
 *
 * @returns {JSX.Element} The page.
 */
export function TwoFactorPage() {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [password, setPassword] = useState('');
  const [enrolment, setEnrolment] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(undefined);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(await api.getTwoFactor());
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Confirms the password and returns a single use settings token.
   *
   * @returns {Promise<string>} The token.
   */
  async function confirmPassword() {
    const result = await api.confirmPassword({ password });
    setPassword('');
    return result.token;
  }

  /**
   * Runs one action behind a fresh settings token.
   *
   * @param {Function} action Receives the token.
   * @returns {Promise<void>}
   */
  async function withConfirmation(action) {
    setActionError(null);
    setNotice(null);

    if (password.length === 0) {
      setActionError(new Error('Enter your password to confirm this change.'));
      return;
    }

    setIsBusy(true);
    try {
      await action(await confirmPassword());
      await load();
    } catch (error) {
      setActionError(error);
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Starts enrolment and shows the secret.
   *
   * @returns {Promise<void>}
   */
  function beginSetup() {
    return withConfirmation(async (settingsToken) => {
      setEnrolment(await api.setupTwoFactor({ settings_token: settingsToken }));
      setRecoveryCodes(null);
    });
  }

  /**
   * Confirms the code and turns the factor on.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function confirmCode(event) {
    event.preventDefault();

    const message = validateTotpCode(code);
    if (message !== null) {
      setCodeError(message);
      return;
    }
    setCodeError(undefined);

    await withConfirmation(async (settingsToken) => {
      const result = await api.enableTwoFactor({ settings_token: settingsToken, code });
      setEnrolment(null);
      setCode('');
      setRecoveryCodes(result.recovery_codes);
      setNotice('Two factor authentication is on.');
    });
  }

  /**
   * Turns the factor off.
   *
   * @returns {Promise<void>}
   */
  function disable() {
    if (!window.confirm('Remove the second factor from this account?')) return Promise.resolve();

    return withConfirmation(async (settingsToken) => {
      await api.disableTwoFactor({ settings_token: settingsToken });
      setRecoveryCodes(null);
      setNotice('Two factor authentication is off.');
    });
  }

  /**
   * Replaces every recovery code.
   *
   * @returns {Promise<void>}
   */
  function regenerate() {
    return withConfirmation(async (settingsToken) => {
      const result = await api.regenerateRecoveryCodes({ settings_token: settingsToken });
      setRecoveryCodes(result.recovery_codes);
      setNotice('New recovery codes issued. The old ones no longer work.');
    });
  }

  if (isLoading) {
    return (
      <div className="container narrow">
        <section className="panel">
          <LoadingState label="Loading two factor settings" />
        </section>
      </div>
    );
  }

  const enabled = status?.enabled === true;

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: 'Account settings', to: paths.accountSettings() },
          { label: 'Two factor' },
        ]}
      />

      <h1>Two factor authentication</h1>
      <p className="lead">
        A code from an authenticator app, asked for after your password. It is what keeps
        somebody who has your password from having your account.
      </p>

      <ErrorMessage error={loadError} />
      <ErrorMessage error={actionError} />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Status</h2>
          <span className={`badge ${enabled ? 'badge--ok' : ''}`}>{enabled ? 'On' : 'Off'}</span>
        </div>

        {enabled ? (
          <p className="muted">
            {status.recovery_codes_remaining} recovery {status.recovery_codes_remaining === 1 ? 'code' : 'codes'}{' '}
            remaining.
          </p>
        ) : (
          <p className="muted">This account signs in with a password alone.</p>
        )}

        <TextField
          label="Confirm your password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          hint="Every change on this page is confirmed with your password."
          autoComplete="current-password"
        />

        <div className="btn-row">
          {enabled ? (
            <>
              <button type="button" className="btn btn--danger" onClick={disable} disabled={isBusy}>
                Turn off
              </button>
              <button type="button" className="btn" onClick={regenerate} disabled={isBusy}>
                New recovery codes
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={beginSetup}
              disabled={isBusy}
            >
              Set up
            </button>
          )}
          <Link className="btn btn--ghost" to={paths.accountSettings()}>
            Back to settings
          </Link>
        </div>
      </section>

      {enrolment !== null ? (
        <section className="panel">
          <div className="panel__header">
            <h2>Scan this</h2>
          </div>

          <Callout tone="warn" title="This is shown once. It cannot be shown again.">
            <p>
              Scan the code with your authenticator app, or type the secret in by hand, then
              enter the six digits it shows.
            </p>
          </Callout>

          <div style={{ margin: '1rem 0' }}>
            <QrCode value={enrolment.otpauth_uri} label="Two factor setup code" />
          </div>

          <p className="mono" style={{ overflowWrap: 'anywhere' }}>
            {enrolment.secret}
          </p>

          <form onSubmit={confirmCode} noValidate>
            <TextField
              label="Code from your app"
              name="code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError(undefined);
              }}
              placeholder={PLACEHOLDERS.totpCode}
              error={codeError}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />

            <div className="btn-row">
              <button type="submit" className="btn btn--primary" disabled={isBusy}>
                Turn on
              </button>
              <button type="button" className="btn" onClick={() => setEnrolment(null)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {recoveryCodes !== null ? (
        <section className="panel">
          <div className="panel__header">
            <h2>Recovery codes</h2>
          </div>

          <Callout tone="warn" title="Store these now. They cannot be shown again.">
            <p>
              Each one works once, and they are the way back in if you lose your
              authenticator. Without them, a lost phone means a lost account.
            </p>
          </Callout>

          <ul className="feature-list">
            {recoveryCodes.map((recoveryCode) => (
              <li key={recoveryCode} className="mono">
                {recoveryCode}
              </li>
            ))}
          </ul>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--small"
              onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
            >
              Copy
            </button>
            <button type="button" className="btn btn--small" onClick={() => setRecoveryCodes(null)}>
              Done
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
