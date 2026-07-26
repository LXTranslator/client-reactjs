import { useId, useMemo, useState } from 'react';
import {
  LOCALE_INITIALS,
  SUGGESTED_LOCALES,
  filterLocales,
  localeLabel,
} from '../../lib/locales.js';

/**
 * Language picker over the full locale catalogue.
 *
 * There are more than a hundred and forty locales, which is far too many to
 * scroll and far too many to render at once. So the list is never shown whole:
 * it opens on a short suggested set, and narrows by initial letter or by
 * searching. The search covers the code as well as the name, because people
 * arrive knowing one or the other, and `pt_br` and `Brazilian` should find the
 * same row.
 *
 * Selected locales are always rendered, whatever the current filter says, so a
 * choice cannot scroll out of sight and be made twice or lost.
 *
 * @param {object} props Component props.
 * @param {string[]} props.selected Codes currently chosen.
 * @param {Function} props.onToggle Called with a code to add or remove it.
 * @param {string[]} [props.exclude] Codes to leave out entirely.
 * @param {string} [props.label] Field label.
 * @param {string} [props.hint] Supporting text under the label.
 * @returns {JSX.Element} The picker.
 */
export function LocalePicker({ selected, onToggle, exclude = [], label = 'Languages', hint }) {
  const [initial, setInitial] = useState('');
  const [search, setSearch] = useState('');
  const searchId = useId();

  const isBrowsing = initial !== '' || search.trim() !== '';

  const visible = useMemo(() => {
    if (!isBrowsing) return filterLocales({ exclude }).filter((locale) =>
      SUGGESTED_LOCALES.some((entry) => entry.code === locale.code),
    );
    return filterLocales({ initial, search, exclude });
  }, [isBrowsing, initial, search, exclude]);

  // A chosen locale stays on screen even when the filter would hide it.
  const pinned = useMemo(
    () => selected.filter((code) => !visible.some((locale) => locale.code === code)),
    [selected, visible],
  );

  return (
    <div className="locale-picker">
      <span className="field__label">{label}</span>
      {hint ? <p className="muted locale-picker__hint">{hint}</p> : null}

      <div className="locale-picker__controls">
        <div className="field locale-picker__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search languages by name or code
          </label>
          <input
            id={searchId}
            type="search"
            className="field__control"
            placeholder="Search by name or code, for example Thai or th_th"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="alpha-index" role="group" aria-label="Filter languages by first letter">
        <button
          type="button"
          className={`alpha-index__letter${initial === '' ? ' is-selected' : ''}`}
          aria-pressed={initial === ''}
          onClick={() => setInitial('')}
        >
          All
        </button>
        {LOCALE_INITIALS.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`alpha-index__letter${initial === letter ? ' is-selected' : ''}`}
            aria-pressed={initial === letter}
            onClick={() => setInitial(initial === letter ? '' : letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      {!isBrowsing ? (
        <p className="muted locale-picker__note">
          Showing widely used languages. Pick a letter or search to reach the rest.
        </p>
      ) : null}

      <div className="chip-row locale-picker__results">
        {visible.map((locale) => {
          const isSelected = selected.includes(locale.code);
          return (
            <button
              key={locale.code}
              type="button"
              className={`chip${isSelected ? ' is-selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onToggle(locale.code)}
            >
              {locale.label}
              <span className="mono locale-picker__code">{locale.code}</span>
            </button>
          );
        })}

        {visible.length === 0 ? (
          <p className="muted locale-picker__note">
            No language matches that. Try another letter, or clear the search.
          </p>
        ) : null}
      </div>

      {pinned.length > 0 ? (
        <>
          <span className="field__hint">Chosen, hidden by the current filter</span>
          <div className="chip-row locale-picker__results">
            {pinned.map((code) => (
              <button
                key={code}
                type="button"
                className="chip is-selected"
                aria-pressed="true"
                onClick={() => onToggle(code)}
              >
                {localeLabel(code)}
                <span className="mono locale-picker__code">{code}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
