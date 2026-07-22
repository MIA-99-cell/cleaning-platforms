import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printPaymentReceipt } from './receipt';

const basePayment = {
  receipt_no: 'RCP-123',
  created_at: '2024-01-02T03:04:05.000Z',
  amount: 15000,
  payment_method: 'mobile_money',
  service_name: 'Deep Clean',
  company_name: 'CleanPro Ltd',
  status: 'confirmed',
  transaction_ref: 'TX-999',
};

const getWrittenHtml = () => {
  const iframe = document.querySelector('iframe');
  return iframe?.contentWindow?.document?.documentElement?.outerHTML || '';
};

describe('printPaymentReceipt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('appends an iframe and returns true', () => {
    const result = printPaymentReceipt(basePayment);
    expect(result).toBe(true);
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('renders the receipt fields into the iframe document', () => {
    printPaymentReceipt(basePayment);
    const html = getWrittenHtml();
    expect(html).toContain('RCP-123');
    expect(html).toContain('Deep Clean');
    expect(html).toContain('CleanPro Ltd');
    expect(html).toContain('TX-999');
    expect(html).toContain('confirmed');
    // payment_method underscore is replaced with a space
    expect(html).toContain('mobile money');
  });

  it('escapes HTML-sensitive characters to prevent injection', () => {
    printPaymentReceipt({ ...basePayment, service_name: '<script>alert(1)</script>' });
    const html = getWrittenHtml();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to placeholders for missing optional fields', () => {
    printPaymentReceipt({ receipt_no: 'RCP-X', amount: 0 });
    const html = getWrittenHtml();
    expect(html).toContain('RCP-X');
    // default status when none provided
    expect(html).toContain('pending');
  });

  it('cleans up and returns false when the iframe has no content window', () => {
    const spy = vi
      .spyOn(window.HTMLIFrameElement.prototype, 'contentWindow', 'get')
      .mockReturnValue(null);
    const result = printPaymentReceipt(basePayment);
    expect(result).toBe(false);
    expect(document.querySelector('iframe')).toBeNull();
    spy.mockRestore();
  });
});
