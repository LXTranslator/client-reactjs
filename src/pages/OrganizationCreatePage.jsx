import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { paths } from '../lib/paths.js';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/apiClient.js';
import { useAvailability } from '../hooks/useAvailability.js';
import { useForm } from '../hooks/useForm.js';
import { TextField, TextAreaField } from '../components/ui/FormField.jsx';
import { AvailabilityHint } from '../components/ui/AvailabilityHint.jsx';
import { Callout, ErrorMessage } from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import {
  PLACEHOLDERS,
  validateEmail,
  validateUserId,
  validateWebsiteUrl,
} from '../lib/validation.js';

/**
 * Organization creation page.
 *
 * The organization identifier is checked for availability while the visitor
 * types, because it is drawn from the same pool as personal user ids: an
 * organization cannot take an identifier a person already holds, or vice versa.
 *
 * The contact address is checked the same way and is deliberately the
 * organization's own, not the creator's. Billing and account notices go to the
 * organization, which outlives whoever happened to create it.
 *
 * @returns {JSX.Element} The page.
 */
export function OrganizationCreatePage() {
  const { refresh, selectNamespace } = useAuth();
  const navigate = useNavigate();

  const { values, errors, submitError, isSubmitting, handleChange, submit } = useForm({
    user_id: '',
    email: '',
    display_name: '',
    description: '',
    website_url: '',
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
   * Validates and creates the organization.
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
            ? 'That organization id is already taken.'
            : validateUserId(values.user_id),
        email: () =>
          emailAvailability === 'taken'
            ? 'That email address is already registered.'
            : validateEmail(values.email),
        website_url: () => validateWebsiteUrl(values.website_url),
      },
      async () => {
        const result = await api.createOrganization({
          user_id: values.user_id.trim(),
          email: values.email.trim().toLowerCase(),
          ...(values.display_name.trim() ? { display_name: values.display_name.trim() } : {}),
          ...(values.description.trim() ? { description: values.description.trim() } : {}),
        });

        await refresh();

        // Switch straight into the new organization, since that is almost
        // certainly what the visitor wants to work in next.
        selectNamespace(result.namespace.user_id);
        navigate(paths.namespaceSettings(result.namespace.user_id), { replace: true });
      },
    );
  }

  const isBlocked = idAvailability === 'taken' || emailAvailability === 'taken';

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: 'New organization' },
        ]}
      />

      <h1>Create an organization</h1>
      <p className="lead">
        An organization is a shared namespace. It owns projects, has its own members
        and roles, and keeps its own contact address.
      </p>

      <Callout tone="info" title="Identifiers are shared with personal accounts">
        An organization id comes from the same pool as personal user ids, so it cannot
        reuse one that is already taken. Availability is checked as you type.
      </Callout>

      <ErrorMessage error={submitError} />

      <form onSubmit={handleSubmit} noValidate>
        <section className="panel">
          <div className="panel__header">
            <h2>Identity</h2>
          </div>

          <TextField
            label="Organization id"
            name="user_id"
            value={values.user_id}
            onChange={handleChange('user_id')}
            placeholder={PLACEHOLDERS.organizationId}
            hint="Lowercase letters, digits and underscores. 3 to 32 characters. Used in URLs."
            error={errors.user_id}
            autoFocus
            required
            trailing={<AvailabilityHint state={idAvailability} />}
          />

          <TextField
            label="Organization email"
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            placeholder={PLACEHOLDERS.organizationEmail}
            hint="The organization's own address. Billing and account notices go here, not to your personal address."
            error={errors.email}
            required
            trailing={<AvailabilityHint state={emailAvailability} />}
          />
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Profile</h2>
          </div>

          <TextField
            label="Display name"
            name="display_name"
            value={values.display_name}
            onChange={handleChange('display_name')}
            placeholder={PLACEHOLDERS.displayName}
            hint="Optional. Shown across the interface instead of the id."
            error={errors.display_name}
          />

          <TextAreaField
            label="Description"
            name="description"
            value={values.description}
            onChange={handleChange('description')}
            placeholder={PLACEHOLDERS.description}
            error={errors.description}
          />
        </section>

        <div className="btn-row">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSubmitting || isBlocked}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" aria-hidden="true" /> Creating
              </>
            ) : (
              'Create organization'
            )}
          </button>
          <Link className="btn btn--ghost" to={paths.namespaces()}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
