import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { scorePassword } from '../../lib/validation.ts';

/**
 * Form field primitives.
 *
 * Accessibility is handled once here rather than repeated on every page: each
 * control gets a real `<label>`, `aria-invalid` when it fails validation, and
 * `aria-describedby` pointing at whichever of the hint or error is showing. An
 * error is announced with `role="alert"` so a screen reader hears it without
 * the user having to hunt for it.
 */

/** What every field takes, whatever its control. */
interface FieldShellProps {
  /** Visible label. */
  label: ReactNode;
  /** Validation message. */
  error?: string | null;
  /** Helper text. */
  hint?: ReactNode;
  /** Marks the field required. */
  required?: boolean;
  /** Content rendered beside the label. */
  trailing?: ReactNode;
}

/** The props the shell hands its control, tying it to the label, hint and error. */
interface ControlProps {
  id: string;
  className: string;
  'aria-invalid': 'true' | undefined;
  'aria-describedby': string | undefined;
  'aria-required': true | undefined;
}

/** Props for {@link TextField}: the shell's, plus any attribute an input takes. */
export type TextFieldProps = FieldShellProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof FieldShellProps>;

/** Props for {@link TextAreaField}. */
export type TextAreaFieldProps = FieldShellProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof FieldShellProps>;

/** One choice in a {@link SelectField}. */
export interface SelectOption {
  value: string;
  label: string;
}

/** Props for {@link SelectField}. */
export type SelectFieldProps = FieldShellProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, keyof FieldShellProps> & {
    options: SelectOption[];
  };

/** Props for {@link PasswordField}. */
export type PasswordFieldProps = Omit<TextFieldProps, 'type'> & {
  /** Render the meter. */
  showStrength?: boolean;
};

/**
 * The label, hint and error around one control.
 *
 * Every control renders through this, so the three of them cannot drift apart
 * on how a label is tied to its input or how an error is announced.
 *
 * @param props Component props.
 * @param props.label Visible label.
 * @param props.error Validation message.
 * @param props.hint Helper text.
 * @param props.required Marks the field required.
 * @param props.trailing Content rendered beside the label.
 * @param props.children Receives the props the control must carry.
 * @returns The field.
 */
function Field({
  label,
  error,
  hint,
  required = false,
  trailing = null,
  children,
}: FieldShellProps & { children: (control: ControlProps) => ReactNode }) {
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
 * @param props Component props.
 * @param props.label Visible label.
 * @param props.name Field name.
 * @param props.value Current value.
 * @param props.onChange Change handler.
 * @param props.type Input type.
 * @param props.error Validation message.
 * @param props.hint Helper text.
 * @param props.placeholder Example value.
 * @param props.required Marks the field required.
 * @param props.trailing Content rendered beside the label.
 * @returns The field.
 */
export function TextField({
  label,
  error,
  hint,
  required,
  trailing,
  type = 'text',
  ...rest
}: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} trailing={trailing}>
      {(control) => <input type={type} {...control} {...rest} />}
    </Field>
  );
}

/**
 * A labelled textarea.
 *
 * @param props Component props, as for `TextField`.
 * @param props.rows Visible rows.
 * @returns The field.
 */
export function TextAreaField({
  label,
  error,
  hint,
  required,
  rows = 3,
  ...rest
}: TextAreaFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(control) => <textarea rows={rows} {...control} {...rest} />}
    </Field>
  );
}

/**
 * A labelled select.
 *
 * @param props Component props, as for `TextField`.
 * @param props.options Choices.
 * @returns The field.
 */
export function SelectField({ label, error, hint, required, options, ...rest }: SelectFieldProps) {
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
 * @param props Component props.
 * @param props.showStrength Render the meter.
 * @returns The field.
 */
export function PasswordField({ showStrength = false, value, ...props }: PasswordFieldProps) {
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
