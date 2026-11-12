import type { ChangeEvent, ReactNode } from 'react';
import { SelectField } from '../ui/FormField.tsx';
import type { Provider } from '../../lib/types.ts';

/** The fields a platform change sets, to merge into the form's values. */
export interface PlatformChange {
  ai_provider?: string;
  ai_model: string;
}

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
 * @param props Component props.
 * @param props.providers The platform catalogue.
 * @param props.provider Chosen platform name.
 * @param props.model Chosen model.
 * @param props.onChange Receives `{ ai_provider?, ai_model }` to merge.
 * @param props.hint Receives the chosen platform and returns its hint.
 * @returns The two fields.
 */
export function PlatformFields({
  providers,
  provider,
  model,
  onChange,
  hint,
}: {
  providers: Provider[];
  provider: string;
  model: string;
  onChange: (change: PlatformChange) => void;
  hint: (selected: Provider | null) => ReactNode;
}) {
  const selected = providers.find((entry) => entry.name === provider) ?? null;

  /**
   * Switches platform, resetting the model to the new platform's default.
   *
   * @param event Change event.
   */
  function handleProviderChange(event: ChangeEvent<HTMLSelectElement>): void {
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
