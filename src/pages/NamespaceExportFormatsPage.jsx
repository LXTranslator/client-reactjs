import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useNamespace } from '../components/routing/NamespaceRoute.jsx';
import { paths } from '../lib/paths.js';
import { api } from '../lib/apiClient.js';
import { SelectField, TextField, TextAreaField } from '../components/ui/FormField.jsx';
import {
  Callout,
  EmptyState,
  ErrorMessage,
  LoadingState,
} from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import {
  PLACEHOLDERS,
  runValidators,
  validateFieldName,
  validateFormatId,
} from '../lib/validation.js';

/**
 * Export formats owned by a namespace.
 *
 * A format describes the shape a downloaded locale document is written in. It
 * belongs to the namespace rather than to a project, which is the whole point:
 * a team describes the shape its build tooling expects once, and every project
 * underneath can then be downloaded in it.
 *
 * Two formats ship with the application and appear in every namespace.
 * `default` carries the translated string beside the fingerprint of the English
 * master, which is what makes staleness detectable downstream. `key_value`
 * carries the bare string, which is what a localization library reads directly.
 * Neither can be edited or removed, because a build script already downloads
 * with it, and the interface says so rather than offering a button that fails.
 *
 * @returns {JSX.Element} The page.
 */
export function NamespaceExportFormatsPage() {
  const namespace = useNamespace();
  const ns = namespace.user_id;

  const [formats, setFormats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    format_id: '',
    name: '',
    description: '',
    leaf_shape: 'OBJECT',
    value_field: 'value',
    hash_field: 'hash',
    nested: 'true',
  });

  const isStringLeaf = form.leaf_shape === 'STRING';

  /**
   * Loads the namespace's format catalogue.
   *
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.listExportFormats(ns);
      setFormats(result.export_formats ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [ns]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Updates a form field and clears its error.
   *
   * @param {string} field Field name.
   * @returns {Function} Change handler.
   */
  function handleChange(field) {
    return (event) => {
      const { value } = event.target;
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setNotice(null);
    };
  }

  /**
   * Creates a format.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleCreate(event) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    const { errors: found, isValid } = runValidators({
      format_id: () => validateFormatId(form.format_id),
      name: () => (form.name.trim().length === 0 ? 'Name the format.' : null),
      // A string leaf is the translated text itself, so it carries no fields
      // and naming one is refused rather than quietly ignored.
      value_field: () => (isStringLeaf ? null : validateFieldName(form.value_field)),
      hash_field: () => (isStringLeaf ? null : validateFieldName(form.hash_field, false)),
    });

    if (!isValid) {
      setErrors(found);
      return;
    }

    if (
      !isStringLeaf &&
      form.hash_field.trim().length > 0 &&
      form.hash_field.trim() === form.value_field.trim()
    ) {
      setErrors({ hash_field: 'The value and hash fields must have different names.' });
      return;
    }

    setIsSaving(true);
    try {
      await api.createExportFormat(ns, {
        format_id: form.format_id.trim(),
        name: form.name.trim(),
        ...(form.description.trim().length > 0 ? { description: form.description.trim() } : {}),
        leaf_shape: form.leaf_shape,
        // An object leaf names its fields; an empty hash field is an explicit
        // "no fingerprint" rather than an omission, so it is sent as null.
        ...(isStringLeaf
          ? {}
          : {
              value_field: form.value_field.trim(),
              hash_field:
                form.hash_field.trim().length === 0 ? null : form.hash_field.trim(),
            }),
        nested: form.nested === 'true',
      });

      setNotice(`Created the format "${form.format_id.trim()}".`);
      setForm({
        format_id: '',
        name: '',
        description: '',
        leaf_shape: 'OBJECT',
        value_field: 'value',
        hash_field: 'hash',
        nested: 'true',
      });
      await load();
    } catch (error) {
      setActionError(error);
      setErrors(error.fieldErrors ?? {});
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Removes a format the namespace owns.
   *
   * @param {object} format The format.
   * @returns {Promise<void>}
   */
  async function handleRemove(format) {
    const confirmed = window.confirm(
      `Remove the format "${format.format_id}"? Downloads naming it will stop working.`,
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      await api.removeExportFormat(ns, format.format_id);
      setNotice(`Removed the format "${format.format_id}".`);
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Loading export formats" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container narrow">
        <ErrorMessage error={loadError} />
        <Link className="btn" to={paths.namespace(ns)}>
          Back to projects
        </Link>
      </div>
    );
  }

  const builtIn = formats.filter((format) => format.built_in);
  const owned = formats.filter((format) => !format.built_in);

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: ns, to: paths.namespace(ns) },
          { label: 'Export formats' },
        ]}
      />

      <h1>Export formats</h1>
      <p className="lead">
        The shape a downloaded locale document is written in. A format belongs to this
        namespace, so every project underneath can be downloaded in it.
      </p>

      <ErrorMessage error={actionError} />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Built in</h2>
          <span className="badge badge--accent">{builtIn.length}</span>
        </div>

        <Callout tone="info" title="These two always exist">
          <span className="mono">default</span> carries the translated string beside the
          fingerprint of the English master, which is how a consumer detects that a source
          string changed. <span className="mono">key_value</span> carries the bare string,
          ready to use as it is, and carries no fingerprint. Neither can be changed or
          removed, since a build script may already download with it.
        </Callout>

        <div className="formatlist">
          {builtIn.map((format) => (
            <FormatCard key={format.format_id} format={format} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Yours</h2>
          <span className="badge badge--accent">{owned.length}</span>
        </div>

        {owned.length === 0 ? (
          <EmptyState title="This namespace has no formats of its own.">
            <p className="muted">
              Add one when your tooling expects a shape the two built in formats do not
              produce.
            </p>
          </EmptyState>
        ) : (
          <div className="formatlist">
            {owned.map((format) => (
              <FormatCard
                key={format.format_id}
                format={format}
                onRemove={() => handleRemove(format)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Add a format</h2>
        </div>

        <form onSubmit={handleCreate} noValidate>
          <div className="field-row">
            <TextField
              label="Identifier"
              name="format_id"
              value={form.format_id}
              onChange={handleChange('format_id')}
              placeholder={PLACEHOLDERS.formatId}
              hint="Used in the download URL. It cannot be changed afterwards."
              error={errors.format_id}
              required
            />

            <TextField
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange('name')}
              placeholder={PLACEHOLDERS.formatName}
              error={errors.name}
              required
            />
          </div>

          <TextAreaField
            label="Description"
            name="description"
            value={form.description}
            onChange={handleChange('description')}
            placeholder={PLACEHOLDERS.formatDescription}
            error={errors.description}
          />

          <div className="field-row">
            <SelectField
              label="Leaf shape"
              name="leaf_shape"
              value={form.leaf_shape}
              onChange={handleChange('leaf_shape')}
              options={[
                { value: 'OBJECT', label: 'Object, with named fields' },
                { value: 'STRING', label: 'String, the translated text itself' },
              ]}
              hint={
                isStringLeaf
                  ? 'A leaf is the translated text, so it carries no named fields.'
                  : 'Each leaf is an object holding the fields named below.'
              }
            />

            <SelectField
              label="Key layout"
              name="nested"
              value={form.nested}
              onChange={handleChange('nested')}
              options={[
                { value: 'true', label: 'Nested, greeting.hello becomes a tree' },
                { value: 'false', label: 'Flat, greeting.hello stays one key' },
              ]}
            />
          </div>

          {isStringLeaf ? null : (
            <div className="field-row">
              <TextField
                label="Value field"
                name="value_field"
                value={form.value_field}
                onChange={handleChange('value_field')}
                placeholder={PLACEHOLDERS.valueField}
                hint="The field holding the translated string."
                error={errors.value_field}
                required
              />

              <TextField
                label="Hash field"
                name="hash_field"
                value={form.hash_field}
                onChange={handleChange('hash_field')}
                placeholder={PLACEHOLDERS.hashField}
                hint="Leave empty for a leaf with no fingerprint."
                error={errors.hash_field}
              />
            </div>
          )}

          <FormatPreview form={form} />

          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving ? 'Adding' : 'Add format'}
          </button>
        </form>
      </section>
    </div>
  );
}

/**
 * One format in the catalogue.
 *
 * @param {object} props Component props.
 * @param {object} props.format The format.
 * @param {Function} [props.onRemove] Removal handler. Absent for a built in format.
 * @returns {JSX.Element} The card.
 */
function FormatCard({ format, onRemove }) {
  return (
    <div className="formatlist__item">
      <div className="formatlist__body">
        <div className="formatlist__title">
          {format.name} <span className="mono muted">{format.format_id}</span>
          {format.built_in ? <span className="badge">built in</span> : null}
        </div>
        {format.description ? <p className="muted">{format.description}</p> : null}
        <div className="formatlist__meta">
          {format.leaf_shape === 'STRING'
            ? 'String leaves'
            : `Object leaves: ${format.value_field}${
                format.hash_field ? `, ${format.hash_field}` : ' only'
              }`}
          {' · '}
          {format.nested ? 'nested keys' : 'flat keys'}
        </div>
      </div>

      {onRemove ? (
        <div className="formatlist__actions">
          <button type="button" className="btn btn--small btn--danger" onClick={onRemove}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shows what one leaf will look like in the format being described.
 *
 * A format is easier to get right when its effect is visible while it is being
 * written, rather than after a download comes back in the wrong shape.
 *
 * @param {object} props Component props.
 * @param {object} props.form The form values.
 * @returns {JSX.Element} The preview.
 */
function FormatPreview({ form }) {
  const value = 'สวัสดี';
  const hash = '123e4567-e89b-12d3-a456-426614174000';

  let leaf;
  if (form.leaf_shape === 'STRING') {
    leaf = value;
  } else {
    leaf = { [form.value_field.trim() || 'value']: value };
    if (form.hash_field.trim().length > 0) leaf[form.hash_field.trim()] = hash;
  }

  const document =
    form.nested === 'true' ? { greeting: { hello: leaf } } : { 'greeting.hello': leaf };

  return (
    <div className="field">
      <span className="field__label">Preview</span>
      <pre className="formatlist__preview">{JSON.stringify(document, null, 2)}</pre>
    </div>
  );
}
