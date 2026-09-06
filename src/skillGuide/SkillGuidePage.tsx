import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSkillGuide, updateSkillGuide } from './skillGuideApi';
import type { SkillGuideEntry } from '../types/skillGuide';

export function SkillGuidePage() {
  const { firebaseUser } = useAuth();
  const [skills, setSkills] = useState<SkillGuideEntry[]>([]);

  useEffect(() => {
    void getSkillGuide().then((guide) => setSkills(guide?.skills ?? []));
  }, []);

  function updateHowToEvaluate(key: string, value: string) {
    setSkills((current) => current.map((s) => (s.key === key ? { ...s, howToEvaluate: value } : s)));
  }

  function updateRangeDescription(key: string, rangeIndex: number, value: string) {
    setSkills((current) =>
      current.map((s) =>
        s.key === key
          ? { ...s, ranges: s.ranges.map((r, i) => (i === rangeIndex ? { ...r, description: value } : r)) }
          : s
      )
    );
  }

  async function handleSave() {
    if (!firebaseUser) return;
    await updateSkillGuide(skills, firebaseUser.uid);
  }

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Skill Guide</h1>
      <div className="space-y-6">
        {skills.map((skill) => (
          <section key={skill.key} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{skill.label}</h2>
            <div className="mt-3 space-y-3">
              {skill.ranges.map((range, index) => (
                <div key={`${range.min}-${range.max}`}>
                  <label
                    htmlFor={`${skill.key}-range-${index}`}
                    className="mb-1 block text-sm font-medium text-ink"
                  >{`${range.min}-${range.max}`}</label>
                  <textarea
                    id={`${skill.key}-range-${index}`}
                    value={range.description}
                    onChange={(e) => updateRangeDescription(skill.key, index, e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                  />
                </div>
              ))}
              <div>
                <label htmlFor={`${skill.key}-how-to-evaluate`} className="mb-1 block text-sm font-medium text-ink">
                  How to evaluate
                </label>
                <textarea
                  id={`${skill.key}-how-to-evaluate`}
                  value={skill.howToEvaluate}
                  onChange={(e) => updateHowToEvaluate(skill.key, e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                />
              </div>
            </div>
          </section>
        ))}
      </div>
      <button
        onClick={() => void handleSave()}
        className="mt-6 rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        Save
      </button>
    </div>
  );
}
