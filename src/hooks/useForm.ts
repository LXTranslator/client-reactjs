import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import type { ApiError } from '../lib/apiClient.ts';
import { runValidators, type Validators } from '../lib/validation.ts';

/** Field name to its current message. A cleared field holds undefined. */
export type FieldErrors = Record<string, string | undefined>;

/** A control whose value a form field holds. */
type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Behaviour options for {@link useForm}. */
export interface FormOptions {
  /** Runs on every edit, such as clearing a notice. */
  onEdit?: () => void;
}

/** What {@link useForm} hands a page. */
export interface FormState<V> {
  values: V;
  setValues: Dispatch<SetStateAction<V>>;
  errors: FieldErrors;
  setErrors: Dispatch<SetStateAction<FieldErrors>>;
  submitError: Error | null;
  setSubmitError: Dispatch<SetStateAction<Error | null>>;
  isSubmitting: boolean;
  handleChange: (field: keyof V & string) => (event: ChangeEvent<FieldControl>) => void;
  submit: (validators: Validators, action: () => Promise<unknown>) => Promise<void>;
}

/**
 * Holds a form's values and errors, and runs its submission.
 *
 * Every form follows the same rules, written once here instead of once per page:
 *
 *   - a field's error clears as soon as the user edits it;
 *   - nothing is sent until every validator passes;
 *   - a server rejection maps `error.fieldErrors` back onto the fields, as well
 *     as being reported for the form as a whole.
 *
 * @param initialValues Starting value for every field.
 * @param options Behaviour options.
 * @returns `values`, `errors`, `submitError` and `isSubmitting`, with their
 *   setters, plus `handleChange(field)` and `submit(validators, action)`.
 */
export function useForm<V extends object>(
  initialValues: V,
  { onEdit }: FormOptions = {},
): FormState<V> {
  const [values, setValues] = useState<V>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Builds a change handler that updates a field and clears its error.
   *
   * @param field Field name.
   * @returns Change handler.
   */
  function handleChange(field: keyof V & string) {
    return (event: ChangeEvent<FieldControl>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      onEdit?.();
    };
  }

  /**
   * Validates the form and, when it passes, runs the submission.
   *
   * @param validators Field name to validator.
   * @param action Performs the submission; a rejection is reported.
   */
  async function submit(validators: Validators, action: () => Promise<unknown>): Promise<void> {
    setSubmitError(null);

    const { errors: found, isValid } = runValidators(validators);
    setErrors(found);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await action();
    } catch (error) {
      setSubmitError(error as Error);
      const fieldErrors = (error as Partial<ApiError> | null)?.fieldErrors ?? {};
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    values,
    setValues,
    errors,
    setErrors,
    submitError,
    setSubmitError,
    isSubmitting,
    handleChange,
    submit,
  };
}
