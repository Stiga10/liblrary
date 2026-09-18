// The ONE place that decides how availability is rendered. Used by both the public
// catalog card and the admin table, so the thresholds cannot drift apart
// (ui-screen skill, section 6).
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export function AvailabilityBadge({
  available,
  total,
}: {
  available: number;
  total: number;
}) {
  const { t } = useTranslation();

  if (available <= 0) {
    return <Badge className="bg-destructive text-destructive-foreground">{t('catalog.unavailable')}</Badge>;
  }
  if (available === 1) {
    return <Badge className="bg-warning text-warning-foreground">{t('catalog.lastCopy')}</Badge>;
  }
  return (
    <Badge className="bg-success text-success-foreground">
      {t('catalog.available', { available, total })}
    </Badge>
  );
}
