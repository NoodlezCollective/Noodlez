import type {BadgeTone} from '~/components/ui/Badge';

const SUCCESS_STATUSES = new Set([
  'PAID',
  'FULFILLED',
  'SUCCESS',
  'DELIVERED',
  'PICKED_UP',
]);

const ATTENTION_STATUSES = new Set([
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'VOIDED',
  'CANCELLED',
  'FAILURE',
  'ERROR',
  'ON_HOLD',
  'EXPIRED',
]);

/** "PARTIALLY_FULFILLED" → "Partially fulfilled" */
export function humanizeStatus(status?: string | null): string {
  if (!status) return '';
  const text = status.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Badge tone for a financial or fulfillment status. */
export function statusTone(status?: string | null): BadgeTone {
  if (!status) return 'neutral';
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (ATTENTION_STATUSES.has(status)) return 'accent';
  return 'primary';
}

/** Whether a status should use the soft lavender badge (in-progress states). */
export function isPendingStatus(status?: string | null): boolean {
  return statusTone(status) === 'primary';
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/** "Oct 12, 2026" */
export function formatOrderDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}
