import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import api from '../services/api';
import toast from 'react-hot-toast';
import {
  FLUTTERWAVE_NETWORKS,
  handleFlutterwaveResponse,
  initiateBookingFlutterwave,
  initiateProductOrderFlutterwave,
  verifyFlutterwavePayment,
} from './flutterwave';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FLUTTERWAVE_NETWORKS', () => {
  it('offers MTN and Orange mobile money options', () => {
    expect(FLUTTERWAVE_NETWORKS.map((n) => n.value)).toEqual(['MTN', 'ORANGE']);
  });
});

describe('handleFlutterwaveResponse', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('does nothing when there is no next_action', () => {
    handleFlutterwaveResponse({});
    handleFlutterwaveResponse(null);
    expect(toast.success).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('redirects the browser for a redirect_url action', () => {
    handleFlutterwaveResponse({
      next_action: { type: 'redirect_url', redirect_url: { url: 'https://pay.example/x' } },
    });
    expect(window.location.href).toBe('https://pay.example/x');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not redirect when redirect_url is missing its url', () => {
    handleFlutterwaveResponse({ next_action: { type: 'redirect_url', redirect_url: {} } });
    expect(window.location.href).toBe('');
  });

  it('shows the provided note for a payment_instruction action', () => {
    handleFlutterwaveResponse({
      next_action: { type: 'payment_instruction', payment_instruction: { note: 'Dial *126#' } },
    });
    expect(toast.success).toHaveBeenCalledWith('Dial *126#', { duration: 8000 });
  });

  it('shows a default note when the payment_instruction has none', () => {
    handleFlutterwaveResponse({ next_action: { type: 'payment_instruction' } });
    expect(toast.success).toHaveBeenCalledWith(
      'Check your phone and approve the Mobile Money payment prompt.',
      { duration: 8000 }
    );
  });

  it('falls back to a generic message for unknown action types', () => {
    handleFlutterwaveResponse({ next_action: { type: 'something_else' } });
    expect(toast.success).toHaveBeenCalledWith(
      'Payment initiated. Please complete it on your phone.'
    );
  });
});

describe('initiateBookingFlutterwave', () => {
  it('posts the mapped booking payload and returns the nested data', async () => {
    api.post.mockResolvedValue({ data: { data: { reference: 'ref-1' } } });
    const result = await initiateBookingFlutterwave({
      bookingId: 7,
      phone: '650000000',
      network: 'MTN',
      contactEmail: 'a@b.com',
    });
    expect(api.post).toHaveBeenCalledWith('/payments/flutterwave/initiate/booking', {
      booking_id: 7,
      phone: '650000000',
      network: 'MTN',
      contact_email: 'a@b.com',
    });
    expect(result).toEqual({ reference: 'ref-1' });
  });

  it('returns undefined when the response has no data envelope', async () => {
    api.post.mockResolvedValue({ data: {} });
    expect(await initiateBookingFlutterwave({})).toBeUndefined();
  });
});

describe('initiateProductOrderFlutterwave', () => {
  it('posts the mapped order payload and returns the nested data', async () => {
    api.post.mockResolvedValue({ data: { data: { reference: 'ref-2' } } });
    const result = await initiateProductOrderFlutterwave({
      orderGroupId: 'grp-9',
      phone: '651111111',
      network: 'ORANGE',
      contactEmail: 'c@d.com',
    });
    expect(api.post).toHaveBeenCalledWith('/payments/flutterwave/initiate/product-order', {
      order_group_id: 'grp-9',
      phone: '651111111',
      network: 'ORANGE',
      contact_email: 'c@d.com',
    });
    expect(result).toEqual({ reference: 'ref-2' });
  });
});

describe('verifyFlutterwavePayment', () => {
  it('url-encodes the reference and returns the nested data', async () => {
    api.get.mockResolvedValue({ data: { data: { status: 'successful' } } });
    const result = await verifyFlutterwavePayment('ref/with space');
    expect(api.get).toHaveBeenCalledWith(
      '/payments/flutterwave/verify/ref%2Fwith%20space'
    );
    expect(result).toEqual({ status: 'successful' });
  });
});
