import { useId } from 'react';
import { scorePassword } from '../../lib/validation.js';

/**
 * Form field primitives.
 *
 * Accessibility is handled once here rather than repeated on every page: each
 * control gets a real `<label>`, `aria-invalid` when it fails validation, and
 * `aria-describedby` pointing at whichever of the hint or error is showing. An
 * error is announced with `role="alert"` so a screen reader hears it without
 * the user having to hunt for it.
 */

/**
 * A labelled text input.
 *
 * @param {object} props Component props.
 * @param {string} props.label Visible label.
 * @param {string} props.name Field name.
 * @param {string} props.value Current value.
 * @param {Function} props.onChange Change handler.
 * @param {string} [props.type] Input type.
 * @param {string} [props.error] Validation message.
 * @param {string} [props.hint] Helper text.
 * @param {string} [props.placeholder] Example value.
 * @param {boolean} [props.required] Marks the field required.
 * @param {React.ReactNode} [props.trailing] Content rendered beside the label.
 * @returns {JSX.Element} The field.
 */
export function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  placeholder,
  required = false,
  trailing = null,
  ...rest
}) {
  const id = useId();
  const errorId = `${id}_error`;
  const hintId = `${id}_hint`;

  return (
    <div className="field">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {trailing}
      </div>

      <input
        id={id}
        name={name}
        type={type}
        className="field__control"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        aria-required={required || undefined}
        {...rest}
      />

      {error ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A labelled textarea.
 *
 * @param {object} props Component props.
 * @returns {JSX.Element} The field.
 */
export function TextAreaField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  placeholder,
  rows = 3,
  required = false,
  ...rest
}) {
  const id = useId();
  const errorId = `${id}_error`;
  const hintId = `${id}_hint`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <textarea
        id={id}
        name={name}
        rows={rows}
        className="field__control"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...rest}
      />

      {error ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A labelled select.
 *
 * @param {object} props Component props.
 * @returns {JSX.Element} The field.
 */
export function SelectField({ label, name, value, onChange, options, error, hint, ...rest }) {
  const id = useId();
  const errorId = `${id}_error`;
  const hintId = `${id}_hint`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      <select
        id={id}
        name={name}
        className="field__control"
        value={value}
        onChange={onChange}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A password field with an optional strength meter.
 *
 * The meter is presentational. It never gates submission; `validatePassword`
 * does that, and its message names the one missing requirement.
 *
 * @param {object} props Component props.
 * @param {boolean} [props.showStrength] Render the meter.
 * @returns {JSX.Element} The field.
 */
export function PasswordField({ showStrength = false, value, ...props }) {
  const strength = showStrength ? scorePassword(value) : null;

  return (
    <div>
      <TextField {...props} value={value} type="password" autoComplete="new-password" />

      {strength ? (
        <div className="strength" style={{ marginTop: '-0.6rem', marginBottom: '1.1rem' }}>
          <div
            className="strength__track"
            role="progressbar"
            aria-valuenow={strength.score}
            aria-valuemin={0}
            aria-valuemax={5}
            aria-label="Password strength"
          >
            <div
              className="strength__fill"
              style={{
                width: `${(strength.score / 5) * 100}%`,
                background: strength.color,
              }}
            />
          </div>
          <span className="strength__label">{strength.label}</span>
        </div>
      ) : null}
    </div>
  );
}
