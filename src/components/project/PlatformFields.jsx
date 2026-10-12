import { SelectField } from '../ui/FormField.jsx';

/**
 * The AI platform and model a project translates with.
 *
 * Shared by project creation and project settings, which offer the same choice
 * and differ only in what they say about who pays for it.
 *
 * Switching platform resets the model to that platform's default, because
 * keeping the old model would almost certainly name something the new platform
 * does not offer.
 *
 * @param {object} props Component props.
 * @param {Array<object>} props.providers The platform catalogue.
 * @param {string} props.provider Chosen platform name.
 * @param {string} props.model Chosen model.
 * @param {Function} props.onChange Receives `{ ai_provider?, ai_model }` to merge.
 * @param {Function} props.hint Receives the chosen platform and returns its hint.
 * @returns {JSX.Element} The two fields.
 */
export function PlatformFields({ providers, provider, model, onChange, hint }) {
  const selected = providers.find((entry) => entry.name === provider) ?? null;

  /**
   * Switches platform, resetting the model to the new platform's default.
   *
   * @param {React.ChangeEvent} event Change event.
   * @returns {void}
   */
  function handleProviderChange(event) {
    const name = event.target.value;
    const next = providers.find((entry) => entry.name === name);
    onChange({ ai_provider: name, ai_model: next?.default_model ?? '' });
  }

  return (
    <div className="field-row">
      <SelectField
        label="AI provider"
        name="ai_provider"
        value={provider}
        onChange={handleProviderChange}
        options={providers.map((entry) => ({ value: entry.name, label: entry.label }))}
        hint={hint(selected)}
      />

      <SelectField
        label="Model"
        name="ai_model"
        value={model}
        onChange={(event) => onChange({ ai_model: event.target.value })}
        options={(selected?.models ?? []).map((entry) => ({ value: entry, label: entry }))}
      />
    </div>
  );
}
