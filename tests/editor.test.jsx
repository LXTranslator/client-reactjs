import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      getFile: vi.fn(),
      getTranslations: vi.fn(),
      addFileLanguages: vi.fn(),
      mergeFileKeys: vi.fn(),
      downloadArchive: vi.fn(),
      downloadLocale: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

vi.mock('../src/lib/download.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, triggerDownload: vi.fn(), downloadJson: vi.fn() };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { triggerDownload } = await import('../src/lib/download.js');
const { App } = await import('../src/App.jsx');

/** A file that has finished processing. */
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

/** The editor payload for that file. */
const EDITOR_DATA = {
  file: READY_FILE,
  master_lang_code: 'en_us',
  available_locales: ['en_us', 'th_th'],
  stale_translations: [],
  keys: [
    {
      id: 'key_1',
      key_name: 'greeting.hello',
      original_text: 'Hello',
      source_text: null,
      text_hash: 'hash_1',
      translations: [
        {
          id: 'tr_1',
          lang_code: 'th_th',
          translated_text: 'สวัสดี',
          source_hash: 'hash_1',
          is_manual: false,
        },
      ],
    },
  ],
};

const EDITOR_PATH = '/jetsada/project/7/file/file_1';

describe('translation editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.getFile.mockResolvedValue({ file: READY_FILE });
    api.getTranslations.mockResolvedValue(EDITOR_DATA);
  });

  /**
   * Renders the editor and waits for it to settle.
   *
   * @returns {Promise<object>} A user event instance.
   */
  async function openEditor() {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: [EDITOR_PATH] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /add to this file/i })).toBeInTheDocument();
    });

    return user;
  }

  describe('downloading', () => {
    it('offers one archive rather than a download per language', async () => {
      await openEditor();

      expect(
        screen.getByRole('button', { name: /download all \(langs\.zip\)/i }),
      ).toBeInTheDocument();
    });

    it('saves the archive as langs.zip', async () => {
      const blob = new Blob(['zip bytes'], { type: 'application/zip' });
      api.downloadArchive.mockResolvedValue(blob);

      const user = await openEditor();
      await user.click(screen.getByRole('button', { name: /download all/i }));

      await waitFor(() => {
        expect(api.downloadArchive).toHaveBeenCalledWith('file_1');
      });
      expect(triggerDownload).toHaveBeenCalledWith('langs.zip', blob);
    });

    it('reports a failed archive instead of saving an error page', async () => {
      const { ApiError } = await import('../src/lib/apiClient.js');
      api.downloadArchive.mockRejectedValue(
        new ApiError('This file has no translations to download yet.', { status: 400 }),
      );

      const user = await openEditor();
      await user.click(screen.getByRole('button', { name: /download all/i }));

      await waitFor(() => {
        expect(screen.getByText(/no translations to download yet/i)).toBeInTheDocument();
      });
      expect(triggerDownload).not.toHaveBeenCalled();
    });
  });

  describe('adding languages', () => {
    it('offers only languages the file does not already have', async () => {
      await openEditor();

      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');
      expect(within(panel).getByRole('button', { name: /japanese/i })).toBeInTheDocument();
      // en_us and th_th are already on the file.
      expect(within(panel).queryByRole('button', { name: /^Thai/i })).not.toBeInTheDocument();
      expect(within(panel).queryByRole('button', { name: /english \(us\)/i })).not.toBeInTheDocument();
    });

    it('sends the chosen languages and reloads', async () => {
      api.addFileLanguages.mockResolvedValue({ file: READY_FILE, added: ['ja_jp'] });

      const user = await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      await user.click(within(panel).getByRole('button', { name: /japanese/i }));
      await user.click(within(panel).getByRole('button', { name: /add 1 language$/i }));

      await waitFor(() => {
        expect(api.addFileLanguages).toHaveBeenCalledWith('file_1', {
          target_langs: ['ja_jp'],
        });
      });

      // Says plainly that existing languages are left alone, since that is the
      // question a person has before clicking.
      await waitFor(() => {
        expect(screen.getByText(/languages already on the file are left/i)).toBeInTheDocument();
      });
    });

    it('keeps the button inert until something is chosen', async () => {
      await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      expect(within(panel).getByRole('button', { name: /add language/i })).toBeDisabled();
    });

    it('rejects a malformed custom locale before sending it', async () => {
      const user = await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      await user.type(within(panel).getByLabelText(/another locale/i), 'not a locale');
      await user.click(within(panel).getByRole('button', { name: /add locale/i }));

      expect(await within(panel).findByRole('alert')).toHaveTextContent(/locale code/i);
      expect(api.addFileLanguages).not.toHaveBeenCalled();
    });

    it('refuses a custom locale the file already has', async () => {
      const user = await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      await user.type(within(panel).getByLabelText(/another locale/i), 'th_th');
      await user.click(within(panel).getByRole('button', { name: /add locale/i }));

      expect(await within(panel).findByRole('alert')).toHaveTextContent(/already has/i);
    });

    it('surfaces a server rejection', async () => {
      const { ApiError } = await import('../src/lib/apiClient.js');
      api.addFileLanguages.mockRejectedValue(
        new ApiError('Every language listed is already on this file.', { status: 400 }),
      );

      const user = await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      await user.click(within(panel).getByRole('button', { name: /japanese/i }));
      await user.click(within(panel).getByRole('button', { name: /add 1 language$/i }));

      await waitFor(() => {
        expect(screen.getByText(/already on this file/i)).toBeInTheDocument();
      });
    });
  });

  describe('merging keys', () => {
    /**
     * A JSON locale document as a File, the way a drop provides one.
     *
     * @returns {File} The document.
     */
    function localeFile() {
      return new File([JSON.stringify({ greeting: { farewell: 'Goodbye' } })], 'more.json', {
        type: 'application/json',
      });
    }

    it('explains that existing keys are skipped, not overwritten', async () => {
      await openEditor();

      expect(
        screen.getByText(/a key it already holds is skipped whole/i),
      ).toBeInTheDocument();
    });

    it('uploads the dropped document as multipart', async () => {
      api.mergeFileKeys.mockResolvedValue({ file: READY_FILE, existing_key_count: 2 });

      const user = await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      await user.upload(within(panel).getByLabelText(/locale document to merge/i), localeFile());
      await user.click(within(panel).getByRole('button', { name: /merge new keys/i }));

      await waitFor(() => {
        expect(api.mergeFileKeys).toHaveBeenCalledTimes(1);
      });

      const [sentFileId, formData] = api.mergeFileKeys.mock.calls[0];
      expect(sentFileId).toBe('file_1');
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('file')).toBeInstanceOf(File);
    });

    it('keeps the button inert until a file is chosen', async () => {
      await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      expect(within(panel).getByRole('button', { name: /merge new keys/i })).toBeDisabled();
    });

    it('rejects a file that is not JSON before sending it', async () => {
      const user = await openEditor();
      const panel = screen.getByRole('heading', { name: /add to this file/i }).closest('section');

      await user.upload(
        within(panel).getByLabelText(/locale document to merge/i),
        new File(['nope'], 'notes.txt', { type: 'text/plain' }),
      );

      await waitFor(() => {
        expect(within(panel).getByRole('button', { name: /merge new keys/i })).toBeDisabled();
      });
      expect(api.mergeFileKeys).not.toHaveBeenCalled();
    });
  });
});
