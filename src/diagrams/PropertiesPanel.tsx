import type { Dispatch } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BringToFront, SendToBack, Trash2 } from 'lucide-react';
import { SegmentedControl } from '../components/SegmentedControl';
import {
  BALL_STYLES,
  PALETTE_COLORS,
  PLAYER_VIEWS,
  SCENE_LIMITS,
  type BallStyle,
  type CourtPreset,
  type DiagramItem,
  type PlayerView,
  type Scene,
} from '../types/diagram';
import { formatNumber } from '../i18n/format';
import {
  ButtonGroup,
  DestructiveRow,
  GROUP_BUTTON,
  InspectorSection,
  SelectField,
  SliderField,
  SwitchRow,
  TextField,
} from './inspectorControls';
import { tokenColor } from './tokenColor';
import type { EditorAction } from './useDiagramEditor';
import { useT } from '../i18n/I18nProvider';

interface Props {
  item: DiagramItem | null;
  dispatch: Dispatch<EditorAction>;
  selectedCount: number;
}

const ICON = 'h-[18px] w-[18px] shrink-0';

/** Left, up, down, right: one labelled pad for a single item or the whole selection. */
function NudgePad({ onNudge }: { onNudge: (dx: number, dy: number) => void }) {
  const p = useT().diagrams.properties;
  const pad: { label: string; dx: number; dy: number; Icon: typeof ArrowLeft }[] = [
    { label: p.nudgeLeft, dx: -1, dy: 0, Icon: ArrowLeft },
    { label: p.nudgeUp, dx: 0, dy: -1, Icon: ArrowUp },
    { label: p.nudgeDown, dx: 0, dy: 1, Icon: ArrowDown },
    { label: p.nudgeRight, dx: 1, dy: 0, Icon: ArrowRight },
  ];
  return (
    <ButtonGroup label={p.nudge} columns={4}>
      {pad.map(({ label, dx, dy, Icon }) => (
        <button key={label} type="button" aria-label={label} className={GROUP_BUTTON} onClick={() => onNudge(dx, dy)}>
          <Icon className={`${ICON} text-ink-2`} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ))}
    </ButtonGroup>
  );
}

/** Court preset, snap and zones: the first section of the inspector, and the phone's court settings. */
export function CourtSection({
  scene,
  dispatch,
  snapOn,
  onSnapChange,
  title,
}: {
  scene: Scene;
  dispatch: Dispatch<EditorAction>;
  snapOn: boolean;
  onSnapChange: (on: boolean) => void;
  title?: string;
}) {
  const ed = useT().diagrams.editor;
  const presets: { id: CourtPreset; label: string }[] = [
    { id: 'full', label: ed.full },
    { id: 'half', label: ed.half },
    { id: 'blank', label: ed.blank },
  ];
  return (
    <InspectorSection title={title}>
      <SegmentedControl
        label={ed.courtPreset}
        options={presets}
        value={scene.court}
        onChange={(court) => dispatch({ type: 'setCourt', court })}
      />
      <div className="-my-1 flex flex-col">
        <SwitchRow label={ed.snap} checked={snapOn} onChange={onSnapChange} />
        <SwitchRow label={ed.zones} checked={scene.showZones} onChange={() => dispatch({ type: 'toggleZones' })} />
      </div>
    </InspectorSection>
  );
}

export function PropertiesPanel({ item, dispatch, selectedCount }: Props) {
  const t = useT();
  const p = t.diagrams.properties;

  if (selectedCount > 1) {
    return (
      <>
        <InspectorSection title={p.selected(selectedCount)}>
          <NudgePad onNudge={(dx, dy) => dispatch({ type: 'translateSelected', dx, dy })} />
        </InspectorSection>
        <InspectorSection>
          <DestructiveRow onClick={() => dispatch({ type: 'deleteSelected' })} icon={<Trash2 className={ICON} strokeWidth={1.75} aria-hidden="true" />}>
            {p.delete}
          </DestructiveRow>
        </InspectorSection>
      </>
    );
  }

  if (!item) {
    return (
      <InspectorSection>
        <p className="text-footnote text-ink-2">{p.selectPrompt}</p>
      </InspectorSection>
    );
  }
  const set = (patch: Partial<DiagramItem>) => dispatch({ type: 'setItemProp', id: item.id, patch });
  const rotates = item.type !== 'ball' && item.type !== 'pole' && item.type !== 'line' && item.type !== 'arrow';

  return (
    <>
      <InspectorSection title={t.diagrams.palette[item.type]}>
        {'color' in item && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-footnote text-ink-2">{p.colour}</span>
            <div role="group" aria-label={p.colour} className="grid grid-cols-6">
              {PALETTE_COLORS.map((c) => {
                const selected = item.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={p.colours[c]}
                    aria-pressed={selected}
                    onClick={() => set({ color: c })}
                    className="inline-flex h-11 min-w-0 items-center justify-center rounded-sm hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span
                      className={`h-7 w-7 rounded-full border border-ink/15 ${
                        selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                      }`}
                      style={{ background: tokenColor(c) }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {item.type === 'player' && (
          <TextField
            label={p.role}
            value={item.label}
            placeholder={p.rolePlaceholder}
            maxLength={SCENE_LIMITS.labelLength}
            onChange={(e) => set({ label: e.target.value })}
          />
        )}

        {item.type === 'player' && (
          <SelectField label={p.view} value={item.view} onChange={(e) => set({ view: e.target.value as PlayerView })}>
            {PLAYER_VIEWS.map((v) => (
              <option key={v} value={v}>
                {p.views[v]}
              </option>
            ))}
          </SelectField>
        )}

        {item.type === 'player' && item.view === 'token' && (
          <SelectField
            label={p.shape}
            value={item.shape}
            onChange={(e) => set({ shape: e.target.value as 'circle' | 'square' })}
          >
            <option value="circle">{p.circle}</option>
            <option value="square">{p.square}</option>
          </SelectField>
        )}

        {item.type === 'ball' && (
          <SelectField label={p.style} value={item.style} onChange={(e) => set({ style: e.target.value as BallStyle })}>
            {BALL_STYLES.map((s) => (
              <option key={s} value={s}>
                {p.ballStyles[s]}
              </option>
            ))}
          </SelectField>
        )}

        {item.type === 'text' && (
          <>
            <TextField
              label={p.text}
              value={item.content}
              maxLength={SCENE_LIMITS.textLength}
              onChange={(e) => set({ content: e.target.value })}
            />
            <SliderField
              label={p.fontSize}
              valueText={String(item.fontSize)}
              min={2}
              max={8}
              step={1}
              value={item.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })}
            />
          </>
        )}

        {item.type === 'ladder' && (
          <SliderField
            label={p.rungs}
            valueText={String(item.rungs)}
            min={3}
            max={10}
            value={item.rungs}
            onChange={(e) => set({ rungs: Number(e.target.value) })}
          />
        )}

        {item.type === 'arrow' && (
          <>
            <SelectField
              label={p.style}
              value={item.style}
              onChange={(e) => set({ style: e.target.value as 'pass' | 'shot' | 'run' })}
            >
              <option value="pass">{p.arrowStyles.pass}</option>
              <option value="shot">{p.arrowStyles.shot}</option>
              <option value="run">{p.arrowStyles.run}</option>
            </SelectField>
            <SelectField
              label={p.arrowhead}
              value={item.head}
              onChange={(e) => set({ head: e.target.value as 'single' | 'double' })}
            >
              <option value="single">{p.single}</option>
              <option value="double">{p.double}</option>
            </SelectField>
            <SwitchRow label={p.curved} checked={item.curved} onChange={(curved) => set({ curved })} />
          </>
        )}

        {item.type === 'zoneLabel' && (
          <SelectField label={p.zone} value={item.zone} onChange={(e) => set({ zone: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </SelectField>
        )}

        <SliderField
          label={p.size}
          valueText={`${formatNumber(item.size, 1)}×`}
          hint={item.type === 'line' || item.type === 'arrow' ? p.scalesWidth : undefined}
          min={0.5}
          max={2}
          step={0.1}
          value={item.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
        />

        {rotates && (
          <SliderField
            label={p.rotation}
            valueText={`${Math.round(item.rotation)}°`}
            min={-180}
            max={180}
            value={item.rotation}
            onChange={(e) => set({ rotation: Number(e.target.value) })}
          />
        )}

        <NudgePad onNudge={(dx, dy) => dispatch({ type: 'translateItem', id: item.id, dx, dy })} />

        <ButtonGroup label={p.layer} columns={2}>
          <button type="button" className={GROUP_BUTTON} onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'backward' })}>
            <SendToBack className={`${ICON} text-ink-2`} strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{p.sendBackward}</span>
          </button>
          <button type="button" className={GROUP_BUTTON} onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'forward' })}>
            <BringToFront className={`${ICON} text-ink-2`} strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{p.bringForward}</span>
          </button>
        </ButtonGroup>
      </InspectorSection>

      <InspectorSection>
        <DestructiveRow
          onClick={() => dispatch({ type: 'deleteItem', id: item.id })}
          icon={<Trash2 className={ICON} strokeWidth={1.75} aria-hidden="true" />}
        >
          {p.deleteElement}
        </DestructiveRow>
      </InspectorSection>
    </>
  );
}
