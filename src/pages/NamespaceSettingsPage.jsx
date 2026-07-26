import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/apiClient.js';
import { TextField, TextAreaField } from '../components/ui/FormField.jsx';
import { Callout, ErrorMessage, LoadingState } from '../components/ui/Feedback.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import {
  PLACEHOLDERS,
  runValidators,
  validateEmail,
  validateWebsiteUrl,
} from '../lib/validation.js';

/**
 * Organization profile settings, including deletion.
 *
 * Only reachable for an organization namespace. A personal namespace is pointed
 * at account settings instead, which is where its equivalent fields live.
 *
 * @returns {JSX.Element} The page.
 */
export function NamespaceSettingsPage() {
  const { activeNamespace, refresh, selectNamespace, account } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    display_name: '',
    description: '',
    website_url: '',
    email: '',
  });
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isOrganization = activeNamespace?.type === 'ORG';
  const isOwner = activeNamespace?.role === 'OWNER';

  /**
   * Loads the current organization profile.
   *
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    if (!activeNamespace || !isOrganization) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.getNamespace(activeNamespace.user_id);
      setValues({
        display_name: result.namespace.display_name ?? '',
        description: result.namespace.description ?? '',
        website_url: result.namespace.website_url ?? '',
        email: result.namespace.email ?? '',
      });
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [activeNamespace, isOrganization]);

  useEffect(() => {
    load();
  }, [load]);

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
      setIsSaved(false);
    };
  }

  /**
   * Saves the profile.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    setIsSaved(false);

    const { errors: found, isValid } = runValidators({
      email: () => validateEmail(values.email),
      website_url: () => validateWebsiteUrl(values.website_url),
    });

    setErrors(found);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await api.updateNamespace(activeNamespace.user_id, {
        display_name: values.display_name.trim(),
        description: values.description.trim(),
        email: values.email.trim().toLowerCase(),
        ...(values.website_url.trim() ? { website_url: values.website_url.trim() } : {}),
      });
      setIsSaved(true);
      await refresh();
    } catch (error) {
      setSubmitError(error);
      const fieldErrors = error?.fieldErrors ?? {};
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Returns to the personal namespace once the organization is gone.
   *
   * @returns {Promise<void>}
   */
  async function handleDeleted() {
    if (account?.user_id) selectNamespace(account.user_id);
    await refresh();
    navigate('/namespaces', { replace: true });
  }

  if (!activeNamespace) {
    return (
      <div className="container">
        <LoadingState label="Loading namespace" />
      </div>
    );
  }

  if (!isOrganization) {
    return (
      <div className="container narrow">
        <Breadcrumbs
          items={[{ label: 'Namespaces', to: '/namespaces' }, { label: 'Settings' }]}
        />
        <Callout tone="info" title="Personal namespace">
          Organization settings apply to organization namespaces only. Your personal
          namespace is configured from <Link to="/settings">account settings</Link>.
        </Callout>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: '/namespaces' },
          { label: activeNamespace.user_id },
          { label: 'Settings' },
        ]}
      />

      <h1>Organization settings</h1>
      <p className="lead">
        Profile details for <span className="mono">{activeNamespace.user_id}</span>.
      </p>

      <ErrorMessage error={loadError} />

      {isLoading ? (
        <LoadingState label="Loading settings" />
      ) : (
        <>
          <section className="panel">
            <div className="panel__header">
              <h2>Profile</h2>
            </div>

            <ErrorMessage error={submitError} />
            {isSaved ? <Callout tone="ok">Settings saved.</Callout> : null}

            <form onSubmit={handleSubmit} noValidate>
              <TextField
                label="Display name"
                name="display_name"
                value={values.display_name}
                onChange={handleChange('display_name')}
                placeholder={PLACEHOLDERS.displayName}
                error={errors.display_name}
              />

              <TextField
                label="Organization email"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange('email')}
                placeholder={PLACEHOLDERS.organizationEmail}
                hint="The organization's own address. Billing and account notices are sent here rather than to any member's personal address."
                error={errors.email}
                required
              />

              <TextAreaField
                label="Description"
                name="description"
                value={values.description}
                onChange={handleChange('description')}
                placeholder={PLACEHOLDERS.description}
                error={errors.description}
              />

              <TextField
                label="Website"
                name="website_url"
                type="url"
                value={values.website_url}
                onChange={handleChange('website_url')}
                placeholder={PLACEHOLDERS.websiteUrl}
                hint="Must start with http:// or https://."
                error={errors.website_url}
              />

              <div className="btn-row">
                <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving' : 'Save settings'}
                </button>
                <Link className="btn btn--ghost" to="/namespaces/settings/members">
                  Manage members
                </Link>
              </div>
            </form>
          </section>

          <DeleteOrganizationPanel
            namespace={activeNamespace}
            canDelete={isOwner}
            onDeleted={handleDeleted}
          />
        </>
      )}
    </div>
  );
}

/**
 * Danger zone: a two step confirmed deletion.
 *
 * Deleting an organization removes its projects, files and every translation
 * derived from them, so it is deliberately harder than a single click. The
 * first dialog requires the identifier to be retyped, which proves the intended
 * target. The second asks for a final yes, which catches a reflexive click on
 * the first.
 *
 * @param {object} props Component props.
 * @param {object} props.namespace Active organization namespace.
 * @param {boolean} props.canDelete Whether the caller is an owner.
 * @param {Function} props.onDeleted Called after a successful deletion.
 * @returns {JSX.Element} The panel.
 */
function DeleteOrganizationPanel({ namespace, canDelete, onDeleted }) {
  /** `closed`, `naming` for step one, `confirming` for step two. */
  const [stage, setStage] = useState('closed');
  const [typedName, setTypedName] = useState('');
  const [error, setError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const matches = typedName.trim() === namespace.user_id;

  /**
   * Closes the flow and resets it.
   *
   * @returns {void}
   */
  function close() {
    setStage('closed');
    setTypedName('');
    setError(null);
    setDeleteError(null);
  }

  /**
   * Advances from naming to final confirmation.
   *
   * @param {React.FormEvent} [event] Submit event.
   * @returns {void}
   */
  function handleAdvance(event) {
    event?.preventDefault();
    if (!matches) {
      setError(`Type ${namespace.user_id} exactly to continue.`);
      return;
    }
    setError(null);
    setStage('confirming');
  }

  /**
   * Performs the deletion.
   *
   * @returns {Promise<void>}
   */
  async function handleConfirm() {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await api.deleteNamespace(namespace.user_id, typedName.trim());
      close();
      await onDeleted();
    } catch (caught) {
      setDeleteError(caught);
      // Drop back a step so the identifier can be corrected.
      setStage('naming');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Danger zone</h2>
      </div>

      <p className="muted">
        Deleting this organization permanently removes its members, projects, files and
        every translation derived from them. This cannot be undone.
      </p>

      {canDelete ? null : (
        <Callout tone="warn">
          Only an owner can delete an organization. Your role is {namespace.role}.
        </Callout>
      )}

      <button
        type="button"
        className="btn btn--danger"
        disabled={!canDelete}
        onClick={() => setStage('naming')}
      >
        Delete this organization
      </button>

      {/* Step one: prove the target by retyping its identifier. */}
      <Modal
        isOpen={stage === 'naming'}
        title="Delete organization"
        onClose={close}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={!matches}
              onClick={handleAdvance}
            >
              Delete
            </button>
          </>
        }
      >
        <ErrorMessage error={deleteError} />

        <p>
          This removes <strong>{namespace.display_name || namespace.user_id}</strong> and
          everything inside it. Type the organization id to continue.
        </p>

        <form onSubmit={handleAdvance}>
          <TextField
            label={`Organization id`}
            name="confirm_user_id"
            value={typedName}
            onChange={(event) => {
              setTypedName(event.target.value);
              setError(null);
            }}
            placeholder={namespace.user_id}
            hint={`Type ${namespace.user_id} exactly.`}
            error={error}
            autoComplete="off"
          />
        </form>
      </Modal>

      {/* Step two: a final yes, catching a reflexive click on step one. */}
      <Modal
        isOpen={stage === 'confirming'}
        title="Are you absolutely sure?"
        onClose={close}
        actions={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={close}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={handleConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Deleting
                </>
              ) : (
                'Confirm delete'
              )}
            </button>
          </>
        }
      >
        <Callout tone="danger" title="This cannot be undone">
          <strong>{namespace.user_id}</strong> and all of its projects, files and
          translations will be permanently deleted.
        </Callout>
      </Modal>
    </section>
  );
}
