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
 * The label, hint and error around one control.
 *
 * Every control renders through this, so the three of them cannot drift apart
 * on how a label is tied to its input or how an error is announced.
 *
 * @param {object} props Component props.
 * @param {string} props.label Visible label.
 * @param {string} [props.error] Validation message.
 * @param {string} [props.hint] Helper text.
 * @param {boolean} [props.required] Marks the field required.
 * @param {React.ReactNode} [props.trailing] Content rendered beside the label.
 * @param {Function} props.children Receives the props the control must carry.
 * @returns {JSX.Element} The field.
 */
function Field({ label, error, hint, required = false, trailing = null, children }) {
  const id = useId();
  const errorId = `${id}_error`;
  const hintId = `${id}_hint`;

  const labelElement = (
    <label className="field__label" htmlFor={id}>
      {label}
      {required ? (
        <span className="field__required" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );

  return (
    <div className="field">
      {trailing ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          {labelElement}
          {trailing}
        </div>
      ) : (
        labelElement
      )}

      {children({
        id,
        className: 'field__control',
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': error ? errorId : hint ? hintId : undefined,
        'aria-required': required || undefined,
      })}

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
export function TextField({ label, error, hint, required, trailing, type = 'text', ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} trailing={trailing}>
      {(control) => <input type={type} {...control} {...rest} />}
    </Field>
  );
}

/**
 * A labelled textarea.
 *
 * @param {object} props Component props, as for `TextField`.
 * @param {number} [props.rows] Visible rows.
 * @returns {JSX.Element} The field.
 */
export function TextAreaField({ label, error, hint, required, rows = 3, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(control) => <textarea rows={rows} {...control} {...rest} />}
    </Field>
  );
}

/**
 * A labelled select.
 *
 * @param {object} props Component props, as for `TextField`.
 * @param {Array<{value: string, label: string}>} props.options Choices.
 * @returns {JSX.Element} The field.
 */
export function SelectField({ label, error, hint, required, options, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(control) => (
        <select {...control} {...rest}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
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
