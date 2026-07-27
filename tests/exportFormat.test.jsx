import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/*
 * Export formats.
 *
 * Two things are being proved. On the editor, choosing a format actually
 * changes what is downloaded, and choosing one that carries no fingerprint says
 * so rather than silently dropping information a consumer relies on. On the
 * management page, the built in formats are visibly not editable, since the
 * server refuses and a button that fails is worse than no button.
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
      downloadArchive: vi.fn(),
      downloadLocale: vi.fn(),
      listFileExportFormats: vi.fn(),
      listExportFormats: vi.fn(),
      createExportFormat: vi.fn(),
      removeExportFormat: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

vi.mock('../src/lib/download.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, triggerDownload: vi.fn() };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { triggerDownload } = await import('../src/lib/download.js');
const { App } = await import('../src/App.jsx');

/** The three formats the server ships. */
const DEFAULT_FORMAT = {
  format_id: 'default',
  name: 'Value and hash',
  description: 'Every leaf carries the translated string and the fingerprint.',
  leaf_shape: 'OBJECT',
  value_field: 'value',
  hash_field: 'hash',
  nested: true,
  built_in: true,
  created_at: null,
};

const KEY_VALUE_FORMAT = {
  format_id: 'key_value',
  name: 'Key and value',
  description: 'Plain JSON key and value pairs, ready to use as it is.',
  leaf_shape: 'STRING',
  value_field: null,
  hash_field: null,
  nested: true,
  built_in: true,
  created_at: null,
};

const FLAT_KEY_VALUE_FORMAT = {
  format_id: 'flat_key_value',
  name: 'Flat key and value',
  description: 'Plain JSON key and value pairs with the dotted path kept as a single key.',
  leaf_shape: 'STRING',
  value_field: null,
  hash_field: null,
  nested: false,
  built_in: true,
  created_at: null,
};

/** One this namespace created. */
const OWNED_FORMAT = {
  format_id: 'flat_text',
  name: 'Flat text',
  description: null,
  leaf_shape: 'STRING',
  value_field: null,
  hash_field: null,
  nested: false,
  built_in: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

const READY_FILE = {
  id: 'file_1',
  project_id: 7,
  filename: 'en_us.json',
  source_lang_code: 'en_us',
  target_lang_codes: ['th_th'],
  status: 'READY',
  key_count: 1,
  error_message: null,
};

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
const FORMATS_PATH = '/jetsada/settings/export_formats';

describe('export formats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.getFile.mockResolvedValue({ file: READY_FILE });
    api.getTranslations.mockResolvedValue(EDITOR_DATA);
    // A Blob, because every download endpoint serves a file and the client
    // fetches all of them as blobs. Mocking a parsed document here is what let
    // the null download ship: the mock returned something the real client never
    // produces.
    api.downloadLocale.mockResolvedValue(
      new Blob([JSON.stringify({ greeting: { hello: 'สวัสดี' } })], {
        type: 'application/json',
      }),
    );
    api.listFileExportFormats.mockResolvedValue({
      export_formats: [DEFAULT_FORMAT, KEY_VALUE_FORMAT, FLAT_KEY_VALUE_FORMAT],
    });
    api.listExportFormats.mockResolvedValue({
      export_formats: [DEFAULT_FORMAT, KEY_VALUE_FORMAT, FLAT_KEY_VALUE_FORMAT],
    });
  });

  describe('choosing one on the editor', () => {
    /**
     * Opens the editor and waits for the format select to appear.
     *
     * @returns {Promise<object>} A user event instance.
     */
    async function openEditor() {
      const user = userEvent.setup();
      renderWithProviders(<App />, { initialEntries: [EDITOR_PATH] });

      // Waiting for the select itself rather than the heading, because the
      // catalogue resolves after the page first renders.
      await waitFor(() => {
        expect(screen.getByLabelText('Format')).toBeInTheDocument();
      });

      return user;
    }

    it('offers every format the namespace has', async () => {
      await openEditor();

      const select = screen.getByLabelText('Format');
      expect(within(select).getByRole('option', { name: 'Value and hash' })).toBeInTheDocument();
      expect(within(select).getByRole('option', { name: 'Key and value' })).toBeInTheDocument();
      expect(
        within(select).getByRole('option', { name: 'Flat key and value' }),
      ).toBeInTheDocument();
    });

    it('downloads a locale in the flat key and value format', async () => {
      const user = await openEditor();

      await user.selectOptions(screen.getByLabelText('Format'), 'flat_key_value');
      await user.click(screen.getByRole('button', { name: /download th_th/i }));

      await waitFor(() => {
        expect(api.downloadLocale).toHaveBeenCalledWith('file_1', 'th_th', 'flat_key_value');
      });
      expect(triggerDownload).toHaveBeenCalledWith('th_th.json', expect.any(Blob));
    });

    it('warns that the flat format carries no fingerprint either', async () => {
      const user = await openEditor();

      await user.selectOptions(screen.getByLabelText('Format'), 'flat_key_value');

      expect(await screen.findByText(/carries no fingerprint/i)).toBeInTheDocument();
    });

    it('downloads a locale in the chosen format', async () => {
      const user = await openEditor();

      await user.selectOptions(screen.getByLabelText('Format'), 'key_value');
      await user.click(screen.getByRole('button', { name: /download th_th/i }));

      await waitFor(() => {
        expect(api.downloadLocale).toHaveBeenCalledWith('file_1', 'th_th', 'key_value');
      });
      expect(triggerDownload).toHaveBeenCalledWith('th_th.json', expect.any(Blob));
    });

    it('downloads the archive in the chosen format', async () => {
      const user = await openEditor();
      api.downloadArchive.mockResolvedValue(new Blob(['zip']));

      await user.selectOptions(screen.getByLabelText('Format'), 'key_value');
      await user.click(screen.getByRole('button', { name: /download all/i }));

      await waitFor(() => {
        expect(api.downloadArchive).toHaveBeenCalledWith('file_1', 'key_value');
      });
    });

    it('warns that a format without a fingerprint cannot report staleness', async () => {
      const user = await openEditor();

      expect(screen.queryByText(/carries no fingerprint/i)).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Format'), 'key_value');

      expect(await screen.findByText(/carries no fingerprint/i)).toBeInTheDocument();
    });

    it('hides the picker when only one format exists', async () => {
      api.listFileExportFormats.mockResolvedValue({ export_formats: [DEFAULT_FORMAT] });
      renderWithProviders(<App />, { initialEntries: [EDITOR_PATH] });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download all/i })).toBeInTheDocument();
      });

      expect(screen.queryByLabelText('Format')).not.toBeInTheDocument();
    });

    it('still renders the editor when the catalogue cannot be loaded', async () => {
      // A format list is a convenience. Losing it must not cost the editor.
      api.listFileExportFormats.mockRejectedValue(new Error('nope'));
      renderWithProviders(<App />, { initialEntries: [EDITOR_PATH] });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download all/i })).toBeInTheDocument();
      });
    });
  });

  describe('managing them', () => {
    /**
     * Opens the management page and waits for it to settle.
     *
     * @returns {Promise<object>} A user event instance.
     */
    async function openFormats() {
      const user = userEvent.setup();
      renderWithProviders(<App />, { initialEntries: [FORMATS_PATH] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Built in' })).toBeInTheDocument();
      });

      return user;
    }

    it('separates the built in formats from the namespace own', async () => {
      api.listExportFormats.mockResolvedValue({
        export_formats: [DEFAULT_FORMAT, KEY_VALUE_FORMAT, FLAT_KEY_VALUE_FORMAT, OWNED_FORMAT],
      });

      await openFormats();

      // Scoped to the list rather than the panel, because the explanatory
      // callout above it names both built in formats too.
      const builtIn = screen
        .getByRole('heading', { name: 'Built in' })
        .closest('.panel')
        .querySelector('.formatlist');
      const owned = screen
        .getByRole('heading', { name: 'Yours' })
        .closest('.panel')
        .querySelector('.formatlist');

      expect(within(builtIn).getByText('default')).toBeInTheDocument();
      expect(within(builtIn).getByText('key_value')).toBeInTheDocument();
      expect(within(builtIn).getByText('flat_key_value')).toBeInTheDocument();
      expect(within(owned).getByText('flat_text')).toBeInTheDocument();
      expect(within(owned).queryByText('default')).not.toBeInTheDocument();
    });

    it('offers no remove button on a built in format', async () => {
      api.listExportFormats.mockResolvedValue({
        export_formats: [DEFAULT_FORMAT, KEY_VALUE_FORMAT, FLAT_KEY_VALUE_FORMAT, OWNED_FORMAT],
      });

      await openFormats();

      const builtIn = screen.getByRole('heading', { name: 'Built in' }).closest('.panel');
      const owned = screen.getByRole('heading', { name: 'Yours' }).closest('.panel');

      expect(within(builtIn).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
      expect(within(owned).getByRole('button', { name: /remove/i })).toBeInTheDocument();
    });

    it('says so when the namespace has created none', async () => {
      await openFormats();
      expect(screen.getByText(/no formats of its own/i)).toBeInTheDocument();
    });

    it('creates a format from the form', async () => {
      const user = await openFormats();
      api.createExportFormat.mockResolvedValue({ export_format: OWNED_FORMAT });

      await user.type(screen.getByLabelText(/identifier/i), 'flat_text');
      await user.type(screen.getByLabelText(/^name/i), 'Flat text');
      await user.selectOptions(screen.getByLabelText(/leaf shape/i), 'STRING');
      await user.selectOptions(screen.getByLabelText(/key layout/i), 'false');
      await user.click(screen.getByRole('button', { name: /add format/i }));

      await waitFor(() => {
        expect(api.createExportFormat).toHaveBeenCalledWith('jetsada', {
          format_id: 'flat_text',
          name: 'Flat text',
          leaf_shape: 'STRING',
          nested: false,
        });
      });
    });

    it('sends a null hash field when the field is cleared', async () => {
      const user = await openFormats();
      api.createExportFormat.mockResolvedValue({ export_format: OWNED_FORMAT });

      await user.type(screen.getByLabelText(/identifier/i), 'value_only');
      await user.type(screen.getByLabelText(/^name/i), 'Value only');
      await user.clear(screen.getByLabelText(/hash field/i));
      await user.click(screen.getByRole('button', { name: /add format/i }));

      await waitFor(() => {
        expect(api.createExportFormat).toHaveBeenCalledWith(
          'jetsada',
          expect.objectContaining({ hash_field: null, value_field: 'value' }),
        );
      });
    });

    it('refuses a built in identifier before sending anything', async () => {
      const user = await openFormats();

      await user.type(screen.getByLabelText(/identifier/i), 'default');
      await user.type(screen.getByLabelText(/^name/i), 'Mine');
      await user.click(screen.getByRole('button', { name: /add format/i }));

      expect(await screen.findByText(/built in and cannot be redefined/i)).toBeInTheDocument();
      expect(api.createExportFormat).not.toHaveBeenCalled();
    });

    it('refuses a field name that could reach the object prototype', async () => {
      const user = await openFormats();

      await user.type(screen.getByLabelText(/identifier/i), 'polluted');
      await user.type(screen.getByLabelText(/^name/i), 'Polluted');
      await user.clear(screen.getByLabelText(/value field/i));
      await user.type(screen.getByLabelText(/value field/i), '__proto__');
      await user.click(screen.getByRole('button', { name: /add format/i }));

      expect(await screen.findByText(/start with a letter/i)).toBeInTheDocument();
      expect(api.createExportFormat).not.toHaveBeenCalled();
    });

    it('refuses the same name for the value and the hash', async () => {
      const user = await openFormats();

      await user.type(screen.getByLabelText(/identifier/i), 'collided');
      await user.type(screen.getByLabelText(/^name/i), 'Collided');
      await user.clear(screen.getByLabelText(/hash field/i));
      await user.type(screen.getByLabelText(/hash field/i), 'value');
      await user.click(screen.getByRole('button', { name: /add format/i }));

      expect(await screen.findByText(/must have different names/i)).toBeInTheDocument();
      expect(api.createExportFormat).not.toHaveBeenCalled();
    });

    it('hides the field names when a string leaf is chosen', async () => {
      const user = await openFormats();

      expect(screen.getByLabelText(/value field/i)).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText(/leaf shape/i), 'STRING');
      expect(screen.queryByLabelText(/value field/i)).not.toBeInTheDocument();
    });

    it('previews the shape a leaf will take', async () => {
      const user = await openFormats();

      // The object leaf, with both fields.
      expect(screen.getByText(/"value": "สวัสดี"/)).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText(/leaf shape/i), 'STRING');
      await user.selectOptions(screen.getByLabelText(/key layout/i), 'false');

      // A string leaf under a flat key.
      expect(screen.getByText(/"greeting\.hello": "สวัสดี"/)).toBeInTheDocument();
    });

    it('removes a format after a confirmation', async () => {
      api.listExportFormats.mockResolvedValue({
        export_formats: [DEFAULT_FORMAT, KEY_VALUE_FORMAT, FLAT_KEY_VALUE_FORMAT, OWNED_FORMAT],
      });
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const user = await openFormats();
      const owned = screen.getByRole('heading', { name: 'Yours' }).closest('.panel');
      await user.click(within(owned).getByRole('button', { name: /remove/i }));

      await waitFor(() => {
        expect(api.removeExportFormat).toHaveBeenCalledWith('jetsada', 'flat_text');
      });
    });

    it('keeps the format when the confirmation is declined', async () => {
      api.listExportFormats.mockResolvedValue({
        export_formats: [DEFAULT_FORMAT, KEY_VALUE_FORMAT, FLAT_KEY_VALUE_FORMAT, OWNED_FORMAT],
      });
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const user = await openFormats();
      const owned = screen.getByRole('heading', { name: 'Yours' }).closest('.panel');
      await user.click(within(owned).getByRole('button', { name: /remove/i }));

      expect(api.removeExportFormat).not.toHaveBeenCalled();
    });
  });
});
