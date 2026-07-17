import { formatCFA } from './currency';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[m]));

const buildReceiptHtml = (payment) => {
  const receiptNo = payment.receipt_no || `RCP-${Date.now()}`;
  const paidDate = payment.created_at ? new Date(payment.created_at) : new Date();
  const paidDateText = paidDate.toLocaleString();
  const amount = formatCFA(payment.amount ?? payment.total_amount ?? 0);
  const method = (payment.payment_method || '').replace('_', ' ') || '-';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt ${esc(receiptNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; margin: 0; }
    .wrap { max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; }
    .muted { color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    td:first-child { width: 180px; color: #6b7280; }
    .amount { font-size: 20px; font-weight: 700; }
    .foot { margin-top: 18px; font-size: 12px; color: #6b7280; }
    @media print {
      body { padding: 0; }
      .wrap { border: none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>CleanPro Payment Receipt</h1>
      <div class="muted">${esc(receiptNo)}</div>
    </div>
    <table>
      <tr><td>Service</td><td>${esc(payment.service_name || '-')}</td></tr>
      <tr><td>Company</td><td>${esc(payment.company_name || '-')}</td></tr>
      <tr><td>Amount</td><td class="amount">${esc(amount)}</td></tr>
      <tr><td>Payment Method</td><td>${esc(method)}</td></tr>
      <tr><td>Status</td><td>${esc(payment.status || 'pending')}</td></tr>
      <tr><td>Transaction Ref</td><td>${esc(payment.transaction_ref || '-')}</td></tr>
      <tr><td>Date</td><td>${esc(paidDateText)}</td></tr>
    </table>
    <p class="foot">Thank you for choosing CleanPro.</p>
  </div>
</body>
</html>`;
};

export const printPaymentReceipt = (payment) => {
  const html = buildReceiptHtml(payment);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Payment receipt');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    document.body.removeChild(iframe);
    return false;
  }

  const doc = frameWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  };

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      setTimeout(cleanup, 1000);
    }
  };

  // Wait for layout/render before opening print dialog.
  if (frameWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 300);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 300);
  }

  return true;
};
