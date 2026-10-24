import type {BadgeTone} from '~/components/ui/Badge';
import {formatDate} from '~/lib/dates';

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

const ORDER_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

/**
 * "Oct 12, 2026". Formatted in UTC so the server render and the browser
 * agree (no hydration mismatch) and date-only values never show a day early.
 */
export function formatOrderDate(value?: string | null): string {
  return formatDate(value, ORDER_DATE_OPTIONS) ?? '';
}
