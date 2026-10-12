import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './helpers/renderWithProviders.jsx';

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      listAuthProviders: vi.fn().mockResolvedValue({ providers: [] }),
      me: vi.fn(),
      listNamespaces: vi.fn(),
      resetPassword: vi.fn(),
    },
    getAuthToken: vi.fn().mockReturnValue(null),
    setAuthToken: vi.fn(),
  };
});

const { api, ApiError } = await import('../src/lib/apiClient.js');
const { useForm } = await import('../src/hooks/useForm.js');
const { App } = await import('../src/App.jsx');

describe('useForm', () => {
  it('clears a field error as soon as the field is edited', async () => {
    const { result } = renderHook(() => useForm({ name: '' }));

    await act(() => result.current.submit({ name: () => 'Name it.' }, vi.fn()));
    expect(result.current.errors).toEqual({ name: 'Name it.' });

    act(() => result.current.handleChange('name')({ target: { value: 'x' } }));
    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.values.name).toBe('x');
  });

  it('sends nothing while a validator fails', async () => {
    const action = vi.fn();
    const { result } = renderHook(() => useForm({ name: '' }));

    await act(() => result.current.submit({ name: () => 'Name it.' }, action));

    expect(action).not.toHaveBeenCalled();
  });

  it('maps a server rejection back onto the fields', async () => {
    const rejection = new ApiError('Validation failed.', {
      status: 400,
      details: [{ field: 'name', message: 'Already taken.' }],
    });
    const { result } = renderHook(() => useForm({ name: 'dup' }));

    await act(() =>
      result.current.submit({ name: () => null }, () => Promise.reject(rejection)),
    );

    expect(result.current.submitError).toBe(rejection);
    expect(result.current.errors).toEqual({ name: 'Already taken.' });
    expect(result.current.isSubmitting).toBe(false);
  });
});

describe('the reset password form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a server rejection on the field it names', async () => {
    // The page did not map field errors before it moved onto useForm.
    api.resetPassword.mockRejectedValue(
      new ApiError('Validation failed.', {
        status: 400,
        details: [{ field: 'password', message: 'That password has been seen in a breach.' }],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/reset-password?token=abc'] });

    await user.type(await screen.findByLabelText(/^new password/i), 'Abcdefgh12');
    await user.type(screen.getByLabelText(/confirm new password/i), 'Abcdefgh12');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^new password/i)).toHaveAttribute('aria-invalid', 'true');
    });
    expect(api.resetPassword).toHaveBeenCalledWith({
      token: 'abc',
      password: 'Abcdefgh12',
      confirm_password: 'Abcdefgh12',
    });
  });
});
