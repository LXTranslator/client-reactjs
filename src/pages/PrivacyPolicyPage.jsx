import { Link } from 'react-router';
import { paths } from '../lib/paths.js';

/**
 * The privacy policy.
 *
 * Written from what the application actually does rather than from a template,
 * so every claim here can be checked against the code: the account fields are
 * the columns on `accounts`, the session detail is what `account_sessions`
 * stores, and the provider paragraph is the one place customer text leaves the
 * deployment.
 *
 * It is a description of the software's behaviour, not legal advice, and it has
 * not been reviewed by a lawyer. See the closing note on the page itself.
 *
 * @returns {JSX.Element} The page.
 */
export function PrivacyPolicyPage() {
  return (
    <div className="container narrow">
      <section className="hero">
        <span className="eyebrow">Legal</span>
        <h1>Privacy policy</h1>
        <p className="lead">
          What LXTranslator stores, why it stores it, and what leaves the deployment.
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>What is held about you</h2>
        </div>

        <dl className="deflist">
          <div className="deflist__row">
            <dt className="deflist__term">Your account</dt>
            <dd>
              A user id, an email address, and a password stored only as a bcrypt digest.
              Optionally a display name, a short description and a website address. An
              organization also holds its own contact address, used for billing and
              account notices.
            </dd>
          </div>
          <div className="deflist__row">
            <dt className="deflist__term">Your sessions</dt>
            <dd>
              One row per signed in device, holding the browser's user agent string and
              when it was last used. Network addresses are deliberately not recorded: a
              session list exists so you can recognise your own devices, not so anybody
              can reconstruct where you were.
            </dd>
          </div>
          <div className="deflist__row">
            <dt className="deflist__term">Your files</dt>
            <dd>
              The locale files you upload, the strings inside them, every translation
              derived from them, and the edits you make by hand. A copy of each upload is
              archived under a generated identifier; the name you gave the file is kept
              as a label and never used to build a path on disk.
            </dd>
          </div>
          <div className="deflist__row">
            <dt className="deflist__term">Your credentials</dt>
            <dd>
              AI provider API keys are encrypted before storage and are never returned by
              any endpoint, at any role. A second factor secret is encrypted the same way.
              Recovery codes are stored only as digests, so a code cannot be read back out
              of the database.
            </dd>
          </div>
          <div className="deflist__row">
            <dt className="deflist__term">Linked accounts</dt>
            <dd>
              If you link a GitHub or GitLab account, the provider's numeric identifier is
              stored, along with the username and email address it reports, so you can
              recognise which account you linked. The access token issued during that
              exchange is read once and discarded, never stored.
            </dd>
          </div>
          <div className="deflist__row">
            <dt className="deflist__term">Activity</dt>
            <dd>
              A record of authenticated API requests, kept for a limited retention period
              set by the deployment, and conversations with the assistant.
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>What leaves the deployment</h2>
        </div>

        <div className="callout callout--warn">
          <div className="callout__icon" aria-hidden="true">
            !
          </div>
          <div className="callout__body">
            <p>
              Translation and the assistant send your source text to the AI platform your
              project selects, paid for by the API key on your account. That text leaves
              this deployment and is handled under that platform&apos;s own terms, not this
              one. Nothing else is sent anywhere.
            </p>
          </div>
        </div>

        <p>
          Signing in with GitHub or GitLab contacts that provider to confirm who you are.
          Nothing about your projects or files is shared with them.
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Common questions</h2>
        </div>

        <div className="accordion">
          <details className="acc">
            <summary>Can I delete my data?</summary>
            <div className="acc__body">
              <p>
                Deleting a file removes its strings, its translations and its archived
                copy. Deleting an organization removes everything belonging to it. Both
                are permanent and are not recoverable from the interface.
              </p>
            </div>
          </details>

          <details className="acc">
            <summary>Who can see my projects?</summary>
            <div className="acc__body">
              <p>
                A personal namespace is reachable only by the account that owns it. An
                organization namespace is reachable by its members, with what each member
                may do decided by their role. Every request is authorised on the server;
                nothing is hidden by the interface alone.
              </p>
            </div>
          </details>

          <details className="acc">
            <summary>Are passwords or API keys ever shown again?</summary>
            <div className="acc__body">
              <p>
                No. A password is only ever stored as a digest and cannot be recovered,
                only reset. An API key is encrypted and no endpoint returns it. An API
                token, a second factor secret and a recovery code are each shown exactly
                once, when they are created.
              </p>
            </div>
          </details>

          <details className="acc">
            <summary>Where is this data held?</summary>
            <div className="acc__body">
              <p>
                In the database belonging to whoever operates this deployment. LXTranslator
                is software rather than a hosted service, so the answer depends on who runs
                it — ask the operator of this instance.
              </p>
            </div>
          </details>
        </div>
      </section>

      <section className="panel">
        <div className="callout callout--info">
          <div className="callout__icon" aria-hidden="true">
            i
          </div>
          <div className="callout__body">
            <p>
              <strong>This page describes how the software behaves.</strong> It is not
              legal advice and has not been reviewed by a lawyer. An operator deploying
              LXTranslator should have it reviewed against the obligations that apply to
              them before relying on it.
            </p>
          </div>
        </div>

        <p className="muted">
          See also the <Link to={paths.termsOfService()}>terms of service</Link>.
        </p>
      </section>
    </div>
  );
}
