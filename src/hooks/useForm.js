import { useState } from 'react';
import { runValidators } from '../lib/validation.js';

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
 * @param {object} initialValues Starting value for every field.
 * @param {object} [options] Behaviour options.
 * @param {Function} [options.onEdit] Runs on every edit, such as clearing a notice.
 * @returns {object} `values`, `errors`, `submitError` and `isSubmitting`, with their
 *   setters, plus `handleChange(field)` and `submit(validators, action)`.
 */
export function useForm(initialValues, { onEdit } = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Builds a change handler that updates a field and clears its error.
   *
   * @param {string} field Field name.
   * @returns {Function} Change handler.
   */
  function handleChange(field) {
    return (event) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      onEdit?.();
    };
  }

  /**
   * Validates the form and, when it passes, runs the submission.
   *
   * @param {Record<string, () => (string|null)>} validators Field name to validator.
   * @param {Function} action Performs the submission; a rejection is reported.
   * @returns {Promise<void>}
   */
  async function submit(validators, action) {
    setSubmitError(null);

    const { errors: found, isValid } = runValidators(validators);
    setErrors(found);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await action();
    } catch (error) {
      setSubmitError(error);
      const fieldErrors = error?.fieldErrors ?? {};
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
