import { formatDate, formatLKR } from '@/lib/format';
import type { Invoice, InvoiceItem } from '@/lib/types';

type PrintableInvoice = Invoice & {
  customer?: { name: string; phone: string | null } | null;
  invoice_items?: InvoiceItem[];
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char] ?? char));
}

export function printInvoice(invoice: PrintableInvoice): boolean {
  if (typeof window === 'undefined') return false;

  const popup = window.open('', '_blank', 'width=760,height=900');
  if (!popup) return false;

  const itemRows = (invoice.invoice_items ?? []).map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td class="center">${escapeHtml(item.quantity)}</td>
      <td class="amount">${escapeHtml(formatLKR(item.unit_price))}</td>
      <td class="amount strong">${escapeHtml(formatLKR(item.line_total))}</td>
    </tr>`).join('');

  popup.document.write(`<!doctype html>
  <html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.invoice_number)}</title>
  <style>
    * { box-sizing: border-box; } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #17211e; background: #f4f7f6; }
    .invoice { width: min(760px, 100%); margin: 24px auto; background: #fff; padding: 44px; }
    .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #047857; padding-bottom: 24px; }
    .brand { color: #047857; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 6px; }
    .sub { color: #64748b; font-size: 13px; margin: 0; }.invoice-title { font-size: 22px; font-weight: 800; text-align: right; margin: 0 0 7px; }
    .number { color: #047857; font-size: 15px; font-weight: 700; text-align: right; }.details { display: flex; justify-content: space-between; gap: 24px; padding: 26px 0; }
    .label { color: #64748b; text-transform: uppercase; letter-spacing: .7px; font-size: 10px; font-weight: 700; margin-bottom: 6px; }.value { font-size: 14px; line-height: 1.55; }.right { text-align: right; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; } th { text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; padding: 10px 8px; border-bottom: 1px solid #cfe1d9; }
    td { padding: 12px 8px; border-bottom: 1px solid #edf1ef; }.center { text-align: center; }.amount { text-align: right; }.strong { font-weight: 700; }.totals { width: 280px; margin-left: auto; margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }.grand { border-top: 2px solid #047857; margin-top: 7px; padding-top: 11px; font-size: 18px; font-weight: 800; color: #047857; }
    .footer { margin-top: 38px; border-top: 1px solid #e1e9e6; padding-top: 18px; color: #64748b; font-size: 12px; text-align: center; }
    @media print { body { background: #fff; } .invoice { width: 100%; margin: 0; padding: 20mm 14mm; } }
  </style></head><body><main class="invoice">
    <section class="top"><div><h1 class="brand">Haya Foods</h1><p class="sub">Sales, Billing, Inventory &amp; Delivery</p></div><div><h2 class="invoice-title">SALES INVOICE</h2><div class="number">${escapeHtml(invoice.invoice_number)}</div></div></section>
    <section class="details"><div><div class="label">Bill to</div><div class="value"><strong>${escapeHtml(invoice.customer?.name ?? 'Walk-in Customer')}</strong>${invoice.customer?.phone ? `<br>${escapeHtml(invoice.customer.phone)}` : ''}</div></div><div class="right"><div class="label">Invoice date</div><div class="value">${escapeHtml(formatDate(invoice.created_at))}</div><div class="label" style="margin-top:12px">Payment status</div><div class="value">${escapeHtml(invoice.payment_status.toUpperCase())}</div></div></section>
    <table><thead><tr><th>Item</th><th class="center">Qty</th><th class="amount">Unit price</th><th class="amount">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
    <section class="totals"><div class="total-row"><span>Subtotal</span><span>${escapeHtml(formatLKR(invoice.subtotal))}</span></div>${invoice.discount_amount > 0 ? `<div class="total-row"><span>Discount</span><span>− ${escapeHtml(formatLKR(invoice.discount_amount))}</span></div>` : ''}<div class="total-row"><span>Tax</span><span>${escapeHtml(formatLKR(invoice.tax_amount))}</span></div><div class="total-row grand"><span>Total</span><span>${escapeHtml(formatLKR(invoice.total))}</span></div><div class="total-row"><span>Paid</span><span>${escapeHtml(formatLKR(invoice.paid_amount))}</span></div><div class="total-row"><span>Balance</span><span>${escapeHtml(formatLKR(invoice.balance))}</span></div></section>
    <footer class="footer">Thank you for choosing Haya Foods.</footer>
  </main><script>window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 250); };</script></body></html>`);
  popup.document.close();
  return true;
}
