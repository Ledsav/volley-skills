import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS } from '../../components/Input';
import { SKILLS, type ActionEvent, type Grade, type RosterEntry, type Skill } from '../../types/match';
import { GRADE_LABELS, SKILL_LABELS, validGrades } from '../skillGrades';

interface EditEventDialogProps {
  event: ActionEvent;
  roster: RosterEntry[];
  onSave: (patch: { playerId: string; skill: Skill; grade: Grade }) => void;
  onCancel: () => void;
}

export function EditEventDialog({ event, roster, onSave, onCancel }: EditEventDialogProps) {
  const [playerId, setPlayerId] = useState(event.playerId);
  const [skill, setSkill] = useState<Skill>(event.skill);
  const [grade, setGrade] = useState<Grade>(event.grade);
  const grades = validGrades(skill);
  const effectiveGrade = grades.includes(grade) ? grade : grades[0];

  return (
    <Dialog
      title="Edit action"
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave({ playerId, skill, grade: effectiveGrade })}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Player
          <select className={FIELD_CLASS} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            {roster.map((r) => (
              <option key={r.playerId} value={r.playerId}>#{r.number} {r.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Fundamental
          <select className={FIELD_CLASS} value={skill} onChange={(e) => setSkill(e.target.value as Skill)}>
            {SKILLS.map((s) => (
              <option key={s} value={s}>{SKILL_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Grade
          <select className={FIELD_CLASS} value={effectiveGrade} onChange={(e) => setGrade(e.target.value as Grade)}>
            {grades.map((g) => (
              <option key={g} value={g}>{g} {GRADE_LABELS[skill][g]}</option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  );
}
