import { Link } from 'react-router';
import { paths } from '../lib/paths.js';

/**
 * The terms of service.
 *
 * Describes the obligations that follow from how the software actually works —
 * the account rules the server enforces, what the licence does and does not
 * allow, and where responsibility for AI provider costs sits.
 *
 * Not legal advice, and not reviewed by a lawyer. See the closing note.
 *
 * @returns {JSX.Element} The page.
 */
export function TermsOfServicePage() {
  return (
    <div className="container narrow">
      <section className="hero">
        <span className="eyebrow">Legal</span>
        <h1>Terms of service</h1>
        <p className="lead">
          The terms on which this deployment of LXTranslator is offered to you.
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Your account</h2>
        </div>

        <ul className="feature-list">
          <li>
            You are responsible for what happens through your account. Keep your password
            to yourself, and enable a second factor if the work matters.
          </li>
          <li>
            One account is one identity. Do not share credentials; add people to an
            organization instead, where each has their own account and their own role.
          </li>
          <li>
            A user id becomes part of every address your namespace appears at, so a
            handful of names the application already routes cannot be registered.
          </li>
          <li>
            Tell the operator promptly if you believe your account has been reached by
            somebody else. Ending a session and changing a password both take effect
            immediately.
          </li>
        </ul>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Content you upload</h2>
        </div>

        <p>
          Your locale files and the translations derived from them remain yours. Uploading
          them grants this deployment only what it needs to do the work you asked for:
          storing them, translating them, and serving them back to you.
        </p>

        <p>
          You must have the right to upload what you upload. Do not upload material you do
          not hold the rights to, and do not use the service to produce content that is
          unlawful where you or the operator are.
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>AI provider costs</h2>
        </div>

        <div className="callout callout--warn">
          <div className="callout__icon" aria-hidden="true">
            !
          </div>
          <div className="callout__body">
            <p>
              Translation is paid for by the API key on your own account, billed to you by
              that platform directly. A large upload with many target languages is a large
              number of provider calls. This application does not cap that spend, and
              neither the operator nor LXTranslator is responsible for it.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Availability and change</h2>
        </div>

        <ul className="feature-list">
          <li>
            The service is offered as it is, with no guarantee of availability, and may
            be interrupted for maintenance or for reasons outside the operator&apos;s
            control.
          </li>
          <li>
            Translation quality depends on the AI platform your project selects. Machine
            output should be reviewed before it is published, and the editor exists so
            that it can be corrected by hand.
          </li>
          <li>
            Keep your own copies of anything you cannot afford to lose. Deletion in this
            application is permanent.
          </li>
        </ul>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Licence</h2>
        </div>

        <p>
          LXTranslator is proprietary software, reserved for the LXTranslator organization.
          Using this deployment grants no right to copy, redistribute or create derivative
          works from it. See the <code>LICENSE</code> file in the source repository for the
          full terms, which prevail over this summary.
        </p>
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
          See also the <Link to={paths.privacyPolicy()}>privacy policy</Link>.
        </p>
      </section>
    </div>
  );
}
