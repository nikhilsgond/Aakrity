import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VerifyOtpPage from '@features/auth/page/VerifyOtpPage';

const mockVerifyOtp = vi.fn();
const mockResendOtp = vi.fn();
const mockNavigate = vi.fn();

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@features/auth/context/AuthProvider', () => ({
  useAuth: () => ({
    verifyOtp: mockVerifyOtp,
    resendOtp: mockResendOtp,
  }),
}));

vi.mock('@shared/ui/ThemeToggle', () => ({
  default: () => null,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const fillOtpDigits = (digits) => {
  const inputs = document.querySelectorAll('input[id^="otp-"]');
  digits.forEach((digit, index) => {
    const input = inputs[index];
    act(() => {
      input.value = digit;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
};

const pasteOtpDigits = (digits) => {
  const firstInput = document.querySelector('input[id="otp-0"]');
  const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData: () => digits,
    },
  });

  act(() => {
    firstInput.dispatchEvent(pasteEvent);
  });
};

describe('VerifyOtpPage', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockVerifyOtp.mockReset();
    mockResendOtp.mockReset();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  it('renders 8 OTP input boxes', () => {
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[{ pathname: '/verify-otp', state: { email: 'user@example.com' } }]}
        >
          <Routes>
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(document.querySelectorAll('input[id^="otp-"]').length).toBe(8);
  });

  it('submits an 8 digit OTP to verifyOtp', async () => {
    mockVerifyOtp.mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[{ pathname: '/verify-otp', state: { email: 'user@example.com' } }]}
        >
          <Routes>
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    pasteOtpDigits('12345678');

    const form = document.querySelector('form');

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '12345678',
      type: 'email',
    });
  });

  it('shows validation error when OTP has fewer than 8 digits', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[{ pathname: '/verify-otp', state: { email: 'user@example.com' } }]}
        >
          <Routes>
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    fillOtpDigits(['1', '2', '3', '4', '5', '6', '7']);

    const form = document.querySelector('form');

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter the 8 digit OTP.');
  });
});
