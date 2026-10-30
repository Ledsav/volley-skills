import { useEffect } from 'react';
import { Search } from 'lucide-react';
import { useMediaQuery } from '../components/useMediaQuery';
import { useT } from '../i18n/I18nProvider';
import { useSearch } from '../search/SearchProvider';
import { Tip } from './Tip';
import { useTip } from './useTip';

/** Same test as the toolbar's shortcut hint. */
const IS_MAC = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

/** The "Find anything" tip on Today. The wording follows the device; it ends when the search palette opens. */
export function SearchTip() {
  const t = useT().onboarding.tips.search;
  const phone = useMediaQuery('(max-width: 767px)', false);
  const { isOpen } = useSearch();
  const { visible, dismiss } = useTip('search');
  useEffect(() => {
    if (visible && isOpen) dismiss();
  }, [visible, isOpen, dismiss]);
  const line = phone ? t.linePhone : IS_MAC ? t.lineMac : t.lineOther;
  return <Tip id="search" icon={Search} title={t.title} line={line} />;
}
