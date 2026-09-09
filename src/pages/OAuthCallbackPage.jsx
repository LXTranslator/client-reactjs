import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/apiClient.js';
import { paths } from '../lib/paths.js';
import { TextField } from '../components/ui/FormField.jsx';
import { Callout, ErrorMessage, LoadingState } from '../components/ui/Feedback.jsx';
import { PLACEHOLDERS, validateTotpCode } from '../lib/validation.js';
import { OAUTH_MODE_KEY } from '../components/account/OAuthProviderButtons.jsx';

/**
 * Finishes a provider redirect.
 *
 * The first thing this page does is take the code and state out of the address
 * bar. They are single use credentials, and a URL reaches browser history, the
 * referrer header and any proxy log on the way — so the query string is
 * replaced before anything else happens.
 *
 * An account with a second factor is challenged here too, exactly as a password
 * sign in would be. The step is rendered on this page rather than handed to
 * another route, so the challenge token never travels anywhere.
 *
 * @returns {JSX.Element} The page.
 */
export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeOauthLogin, completeMfa } = useAuth();

  const [error, setError] = useState(null);
  const [challengeToken, setChallengeToken] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // React runs effects twice in development strict mode, and this one spends a
  // single use credential.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const state = searchParams.get('state');
    const authorizationCode = searchParams.get('code');
    const providerError = searchParams.get('error');

    let mode = 'LOGIN';
    try {
      mode = window.sessionStorage.getItem(OAUTH_MODE_KEY) ?? 'LOGIN';
      window.sessionStorage.removeItem(OAUTH_MODE_KEY);
    } catch {
      mode = 'LOGIN';
    }

    // Out of the address bar before anything is done with it.
    navigate(paths.oauthCallback(), { replace: true });

    if (providerError !== null) {
      setError(new Error('That sign in was cancelled or refused by the provider.'));
      return;
    }
    if (state === null || authorizationCode === null) {
      setError(new Error('That sign in attempt is invalid or has expired.'));
      return;
    }

    if (mode === 'LINK') {
      api
        .completeOauthLink({ state, code: authorizationCode })
        .then(() => navigate(paths.linkedAccounts(), { replace: true }))
        .catch(setError);
      return;
    }

    completeOauthLogin({ state, code: authorizationCode })
      .then((result) => {
        if (result.mfaRequired) {
          setChallengeToken(result.challengeToken);
          return;
        }
        navigate(paths.namespace(result.account.user_id), { replace: true });
      })
      .catch(setError);
  }, [searchParams, navigate, completeOauthLogin]);

  /**
   * Answers the second factor challenge.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleChallenge(event) {
    event.preventDefault();
    setError(null);

    const message = validateTotpCode(code);
    if (message !== null) {
      setCodeError(message);
      return;
    }
    setCodeError(undefined);

    setIsSubmitting(true);
    try {
      const account = await completeMfa({ challengeToken, code });
      navigate(paths.namespace(account.user_id), { replace: true });
    } catch (caught) {
      setError(caught);
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
          <h1>{challengeToken !== null ? 'One more step' : 'Finishing sign in'}</h1>
        </div>

        <ErrorMessage error={error} />

        {challengeToken !== null ? (
          <form onSubmit={handleChallenge} noValidate>
            <TextField
              label="Authentication code"
              name="code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError(undefined);
              }}
              placeholder={PLACEHOLDERS.totpCode}
              hint="Six digits from your authenticator app, or one of your recovery codes."
              error={codeError}
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
        ) : null}

        {error !== null ? (
          <>
            <Callout tone="info" title="What to do now">
              <p>
                Sign in with your password, then connect the account from your settings. A
                provider account has to be linked before it can sign you in.
              </p>
            </Callout>
            <p className="auth__footer">
              <Link to={paths.login()}>Back to sign in</Link>
            </p>
          </>
        ) : null}

        {error === null && challengeToken === null ? (
          <LoadingState label="Completing sign in" />
        ) : null}
      </div>
    </div>
  );
}
