import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS, Input } from '../../components/Input';
import type { SetScore, Side } from '../../types/match';

interface CorrectionDialogProps {
  score: SetScore;
  serving: Side;
  rotation: number;
  onSave: (c: { score: SetScore | null; serving: Side | null; rotation: number | null }) => void;
  onCancel: () => void;
}

export function CorrectionDialog({ score, serving, rotation, onSave, onCancel }: CorrectionDialogProps) {
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
      title="Correct the game state"
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save correction</Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate">Logged as a correction — stats are not changed.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Us
          <Input type="number" min={0} className="tabular-nums" value={us} onChange={(e) => setUs(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Them
          <Input type="number" min={0} className="tabular-nums" value={them} onChange={(e) => setThem(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Serving
          <select className={FIELD_CLASS} value={srv} onChange={(e) => setSrv(e.target.value as Side)}>
            <option value="us">Us</option>
            <option value="them">Them</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Rotation
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
