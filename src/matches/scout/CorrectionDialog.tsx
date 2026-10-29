import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS, Input } from '../../components/Input';
import type { SetScore, Side } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';

interface CorrectionDialogProps {
  score: SetScore;
  serving: Side;
  rotation: number;
  onSave: (c: { score: SetScore | null; serving: Side | null; rotation: number | null }) => void;
  onCancel: () => void;
}

export function CorrectionDialog({ score, serving, rotation, onSave, onCancel }: CorrectionDialogProps) {
  const t = useT();
  const [us, setUs] = useState(score.us);
  const [them, setThem] = useState(score.them);
  const [srv, setSrv] = useState<Side>(serving);
  const [rot, setRot] = useState(rotation);

  function save() {
    const scoreChanged = us !== score.us || them !== score.them;
    onSave({
      score: scoreChanged ? { us, them } : null,
      serving: srv !== serving ? srv : null,
      rotation: rot !== rotation ? rot : null,
    });
  }

  return (
    <Dialog
      title={t.scout.correction.title}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={save}>{t.scout.correction.save}</Button>
        </div>
      }
    >
      <p className="mb-3 text-callout text-ink-2">{t.scout.correction.note}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-callout font-medium text-ink">
          {t.scout.correction.us}
          <Input type="number" min={0} className="tabular-nums" value={us} onChange={(e) => setUs(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-callout font-medium text-ink">
          {t.scout.correction.them}
          <Input type="number" min={0} className="tabular-nums" value={them} onChange={(e) => setThem(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-callout font-medium text-ink">
          {t.scout.correction.serving}
          <select className={FIELD_CLASS} value={srv} onChange={(e) => setSrv(e.target.value as Side)}>
            <option value="us">{t.scout.correction.us}</option>
            <option value="them">{t.scout.correction.them}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-callout font-medium text-ink">
          {t.scout.correction.rotation}
          <select className={FIELD_CLASS} value={rot} onChange={(e) => setRot(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  );
}
