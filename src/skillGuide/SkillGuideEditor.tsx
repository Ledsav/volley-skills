import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { getSkillGuide, updateSkillGuide } from './skillGuideApi';
import { bandBorderClass } from './bandColor';
import type { SkillGuideEntry } from '../types/skillGuide';

export function SkillGuideEditor() {
  const { firebaseUser } = useAuth();
  const [skills, setSkills] = useState<SkillGuideEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkillGuide()
      .then((guide) => {
        setSkills(guide.skills);
        setLoaded(true);
      })
      .catch(() => setLoadError('Could not load the skill guide. Please refresh the page.'));
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
    setError(null);
    if (!firebaseUser) return;
    try {
      await updateSkillGuide(skills, firebaseUser.uid);
    } catch {
      setError('Could not save the skill guide. Please try again.');
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="p-6 text-red">
        {loadError}
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        {skills.map((skill) => (
          <section key={skill.key} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{skill.label}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {skill.ranges.map((range, index) => (
                <div
                  key={`${range.min}-${range.max}`}
                  className={`rounded-r-md border-l-4 bg-bg p-3 ${bandBorderClass(range.min)}`}
                >
                  <label
                    htmlFor={`${skill.key}-range-${index}`}
                    className="mb-1 block text-sm font-medium text-ink"
                  >{`${range.min}-${range.max}`}</label>
                  <Textarea
                    id={`${skill.key}-range-${index}`}
                    value={range.description}
                    onChange={(e) => updateRangeDescription(skill.key, index, e.target.value)}
                    className="w-full bg-surface"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label htmlFor={`${skill.key}-how-to-evaluate`} className="mb-1 block text-sm font-medium text-ink">
                How to evaluate
              </label>
              <Textarea
                id={`${skill.key}-how-to-evaluate`}
                value={skill.howToEvaluate}
                onChange={(e) => updateHowToEvaluate(skill.key, e.target.value)}
              />
            </div>
          </section>
        ))}
      </div>
      <Button variant="primary" onClick={() => void handleSave()} className="mt-6" disabled={!loaded}>
        Save
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
