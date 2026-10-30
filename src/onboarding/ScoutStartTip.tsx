import { memo, useEffect } from 'react';
import { Hand } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';
import { Tip } from './Tip';
import { useTip } from './useTip';

/**
 * The scouting tip above the court. No motion at all, and it is a leaf: `tapped` is a boolean the page already
 * derives from its events, so a tap re-renders this only when that flips. It ends on the first recorded tap.
 */
export const ScoutStartTip = memo(function ScoutStartTip({ tapped }: { tapped: boolean }) {
  const t = useT().onboarding.tips.scoutStart;
  const { visible, dismiss } = useTip('scout-start');
  useEffect(() => {
    if (visible && tapped) dismiss();
  }, [visible, tapped, dismiss]);
  if (tapped) return null;
  return <Tip id="scout-start" icon={Hand} title={t.title} line={t.line} animated={false} className="mb-0" />;
});
