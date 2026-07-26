import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/*
 * Correcting one string, and checking the file for drift.
 *
 * The update control is the interesting part: it exists to answer "I changed
 * the English, now what", and it must not appear when there is nothing to
 * update, because pressing it would spend provider quota to reproduce a
 * translation that is already correct.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      getFile: vi.fn(),
      getTranslations: vi.fn(),
      updateMasterText: vi.fn(),
      updateTranslation: vi.fn(),
      retranslateKeys: vi.fn(),
      checkConsistency: vi.fn(),
      listFileExportFormats: vi.fn(),
      addFileLanguages: vi.fn(),
      mergeFileKeys: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

const READY_FILE = {
  id: 'file_1',
  project_id: 7,
  filename: 'en_us.json',
  source_lang_code: 'en_us',
  target_lang_codes: ['th_th'],
  status: 'READY',
  key_count: 2,
  error_message: null,
};

/**
 * Builds an editor payload.
 *
 * @param {object} [options] Options.
 * @param {boolean} [options.stale] Whether the first key is behind its master.
 * @returns {object} Editor payload.
 */
function makeEditorData({ stale = false } = {}) {
  return {
    file: READY_FILE,
    master_lang_code: 'en_us',
    available_locales: ['en_us', 'th_th'],
    stale_translations: stale
      ? [
          {
            key_name: 'greeting.hello',
            lang_code: 'th_th',
            translated_with_hash: 'hash_old',
            current_hash: 'hash_1',
          },
        ]
      : [],
    keys: [
      {
        id: 'key_1',
        key_name: 'greeting.hello',
        original_text: 'Hello {name}',
        source_text: null,
        text_hash: 'hash_1',
        translations: [
          {
            id: 'tr_1',
            lang_code: 'th_th',
            translated_text: 'สวัสดี {name}',
            source_hash: stale ? 'hash_old' : 'hash_1',
            is_manual: false,
          },
        ],
      },
      {
        id: 'key_2',
        key_name: 'save',
        original_text: 'Save',
        source_text: null,
        text_hash: 'hash_2',
        translations: [
          {
            id: 'tr_2',
            lang_code: 'th_th',
            translated_text: 'บันทึก',
            source_hash: 'hash_2',
            is_manual: false,
          },
        ],
      },
    ],
  };
}

const EDITOR_PATH = '/jetsada/project/7/file/file_1';

describe('partial updates and consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.getFile.mockResolvedValue({ file: READY_FILE });
    api.getTranslations.mockResolvedValue(makeEditorData());
    api.listFileExportFormats.mockResolvedValue({ export_formats: [] });
  });

  /**
   * Renders the editor and waits for the key rows.
   *
   * @returns {Promise<object>} A user event instance.
   */
  async function openEditor() {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: [EDITOR_PATH] });

    await waitFor(() => {
      expect(screen.getByText('greeting.hello')).toBeInTheDocument();
    });

    return user;
  }

  describe('the update control', () => {
    it('is absent while every language matches its master', async () => {
      await openEditor();
      expect(
        screen.queryByRole('button', { name: /update translations/i }),
      ).not.toBeInTheDocument();
    });

    it('appears on the key that has fallen behind, and only that key', async () => {
      api.getTranslations.mockResolvedValue(makeEditorData({ stale: true }));
      await openEditor();

      const buttons = screen.getAllByRole('button', { name: /update translations/i });
      expect(buttons).toHaveLength(1);
    });

    it('refreshes only the key it belongs to', async () => {
      api.getTranslations.mockResolvedValue(makeEditorData({ stale: true }));
      api.retranslateKeys.mockResolvedValue({ file: READY_FILE, keys: [], target_langs: [] });

      const user = await openEditor();
      await user.click(screen.getByRole('button', { name: /update translations/i }));

      await waitFor(() => {
        expect(api.retranslateKeys).toHaveBeenCalledWith('file_1', { key_ids: ['key_1'] });
      });
    });

    it('offers one action for every key that is behind', async () => {
      api.getTranslations.mockResolvedValue(makeEditorData({ stale: true }));
      api.retranslateKeys.mockResolvedValue({ file: READY_FILE, keys: [], target_langs: [] });

      const user = await openEditor();
      await user.click(screen.getByRole('button', { name: /update 1 key/i }));

      await waitFor(() => {
        expect(api.retranslateKeys).toHaveBeenCalledWith('file_1', { key_ids: ['key_1'] });
      });
    });

    it('says a manual correction survives unless its source moved', async () => {
      api.getTranslations.mockResolvedValue(makeEditorData({ stale: true }));
      await openEditor();

      expect(screen.getByText(/corrected by hand survives/i)).toBeInTheDocument();
    });
  });

  describe('saving a master string', () => {
    it('reports which languages the edit left behind', async () => {
      api.updateMasterText.mockResolvedValue({
        key: { id: 'key_1', text_hash: 'hash_new' },
        changed: true,
        stale_lang_codes: ['th_th'],
      });

      const user = await openEditor();

      await user.selectOptions(screen.getByLabelText(/compare with/i), 'en_us');
      const textarea = await screen.findByLabelText(/master text of greeting\.hello/i);
      await user.clear(textarea);
      await user.type(textarea, 'Hello there, {name}');
      await user.click(screen.getAllByRole('button', { name: /^save$/i })[0]);

      expect(await screen.findByText(/1 translation are now behind it/i)).toBeInTheDocument();
    });

    it('says plainly when the text had not actually changed', async () => {
      // The server reports this rather than writing, and saying "saved" would
      // be a small lie that costs trust in the rest of the page.
      api.updateMasterText.mockResolvedValue({
        key: { id: 'key_1', text_hash: 'hash_1' },
        changed: false,
        stale_lang_codes: [],
      });

      const user = await openEditor();

      await user.selectOptions(screen.getByLabelText(/compare with/i), 'en_us');
      const textarea = await screen.findByLabelText(/master text of greeting\.hello/i);
      await user.type(textarea, ' ');
      await user.click(screen.getAllByRole('button', { name: /^save$/i })[0]);

      expect(await screen.findByText(/already saved, so nothing changed/i)).toBeInTheDocument();
    });
  });

  describe('the consistency check', () => {
    /**
     * Opens the editor and returns the consistency panel.
     *
     * @returns {Promise<{user: object, panel: HTMLElement}>}
     */
    async function openPanel() {
      const user = await openEditor();
      const panel = screen.getByRole('heading', { name: /key consistency/i }).closest('.panel');
      return { user, panel };
    }

    it('runs nothing until it is asked to', async () => {
      await openPanel();
      expect(api.checkConsistency).not.toHaveBeenCalled();
    });

    it('checks every language by default', async () => {
      api.checkConsistency.mockResolvedValue({
        file_id: 'file_1',
        master_lang_code: 'en_us',
        checked_lang_codes: ['th_th'],
        checked_key_count: 2,
        consistent: true,
        issue_count: 0,
        truncated: false,
        issues: [],
      });

      const { user, panel } = await openPanel();
      await user.click(within(panel).getByRole('button', { name: /validate key consistency/i }));

      await waitFor(() => {
        expect(api.checkConsistency).toHaveBeenCalledWith('file_1', undefined);
      });
      expect(await screen.findByText(/every language matches the master/i)).toBeInTheDocument();
    });

    it('narrows to one language when one is chosen', async () => {
      api.checkConsistency.mockResolvedValue({
        file_id: 'file_1',
        master_lang_code: 'en_us',
        checked_lang_codes: ['th_th'],
        checked_key_count: 2,
        consistent: true,
        issue_count: 0,
        truncated: false,
        issues: [],
      });

      const { user, panel } = await openPanel();
      await user.selectOptions(within(panel).getByLabelText(/check/i), 'th_th');
      await user.click(within(panel).getByRole('button', { name: /validate key consistency/i }));

      await waitFor(() => {
        expect(api.checkConsistency).toHaveBeenCalledWith('file_1', 'th_th');
      });
    });

    it('groups the issues it finds by kind', async () => {
      api.checkConsistency.mockResolvedValue({
        file_id: 'file_1',
        master_lang_code: 'en_us',
        checked_lang_codes: ['th_th'],
        checked_key_count: 2,
        consistent: false,
        issue_count: 2,
        truncated: false,
        issues: [
          {
            key_id: 'key_1',
            key_name: 'greeting.hello',
            lang_code: 'th_th',
            kind: 'PLACEHOLDER_MISSING',
            detail: 'The master carries {name} and the translation does not.',
            token: '{name}',
          },
          {
            key_id: 'key_2',
            key_name: 'save',
            lang_code: 'th_th',
            kind: 'MISSING_TRANSLATION',
            detail: 'This language has no translation for the key.',
          },
        ],
      });

      const { user, panel } = await openPanel();
      await user.click(within(panel).getByRole('button', { name: /validate key consistency/i }));

      expect(
        await within(panel).findByRole('heading', { name: /placeholder missing/i }),
      ).toBeInTheDocument();
      expect(
        within(panel).getByRole('heading', { name: /no translation/i }),
      ).toBeInTheDocument();
      expect(within(panel).getByText(/carries \{name\} and the translation does not/)).toBeInTheDocument();
      expect(within(panel).getByText('2 to review')).toBeInTheDocument();
    });

    it('says when the list was cut short', async () => {
      api.checkConsistency.mockResolvedValue({
        file_id: 'file_1',
        master_lang_code: 'en_us',
        checked_lang_codes: ['th_th'],
        checked_key_count: 900,
        consistent: false,
        issue_count: 900,
        truncated: true,
        issues: [
          {
            key_id: 'key_1',
            key_name: 'greeting.hello',
            lang_code: 'th_th',
            kind: 'STALE_TRANSLATION',
            detail: 'The master text changed after this translation was written.',
          },
        ],
      });

      const { user, panel } = await openPanel();
      await user.click(within(panel).getByRole('button', { name: /validate key consistency/i }));

      expect(await within(panel).findByText(/first 1 of 900 issues/i)).toBeInTheDocument();
    });

    it('renders a failure without losing the editor', async () => {
      api.checkConsistency.mockRejectedValue(
        Object.assign(new Error('This file has no ko_kr translations.'), { status: 400 }),
      );

      const { user, panel } = await openPanel();
      await user.click(within(panel).getByRole('button', { name: /validate key consistency/i }));

      expect(await within(panel).findByText(/no ko_kr translations/i)).toBeInTheDocument();
      expect(screen.getByText('greeting.hello')).toBeInTheDocument();
    });
  });
});
