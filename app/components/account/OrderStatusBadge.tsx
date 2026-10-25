import {Badge} from '~/components/ui/Badge';
import {humanizeStatus, isPendingStatus, statusTone} from './orderUtils';

/**
 * Financial / fulfillment status rendered as a pill. In-progress statuses use
 * a soft lavender pill, completed ones green and problems coral.
 */
export function OrderStatusBadge({
  status,
  prefix,
}: {
  status?: string | null;
  /** Visually hidden context, e.g. "Payment" → "Payment: Paid". */
  prefix?: string;
}) {
  if (!status) return null;
  return (
    <Badge
      tone={statusTone(status)}
      className={isPendingStatus(status) ? 'badge--soft' : undefined}
    >
      {prefix ? <span className="sr-only">{prefix}: </span> : null}
      {humanizeStatus(status)}
    </Badge>
  );
}
