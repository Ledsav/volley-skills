import { useEffect, useRef } from 'react';
import { PencilRuler } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';
import { Tip } from './Tip';
import { useTip } from './useTip';

/** The diagram editor's tip. It ends on the first element added: the count rising above what it was on open. */
export function DiagramTip({ itemCount, className }: { itemCount: number; className?: string }) {
  const t = useT().onboarding.tips.diagram;
  const { visible, dismiss } = useTip('diagram');
  const initial = useRef(itemCount);
  useEffect(() => {
    if (visible && itemCount > initial.current) dismiss();
  }, [visible, itemCount, dismiss]);
  return <Tip id="diagram" icon={PencilRuler} title={t.title} line={t.line} className={className} />;
}
