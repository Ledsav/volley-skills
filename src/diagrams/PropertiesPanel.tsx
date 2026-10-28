import type { Dispatch } from 'react';
import {
  BALL_STYLES,
  PALETTE_COLORS,
  PLAYER_VIEWS,
  SCENE_LIMITS,

  type BallStyle,
  type DiagramItem,
  type PlayerView,
} from '../types/diagram';
import { tokenColor } from './tokenColor';
import type { EditorAction } from './useDiagramEditor';
import { useT } from '../i18n/I18nProvider';

interface Props {
  item: DiagramItem | null;
  dispatch: Dispatch<EditorAction>;
  selectedCount: number;
}

const nudgeBtn =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 py-1';



export function PropertiesPanel({ item, dispatch, selectedCount }: Props) {
  const p = useT().diagrams.properties;
  if (selectedCount > 1) {
    return (
      <div className="flex flex-col gap-3 p-3 text-sm">
        <p className="font-medium text-ink">{p.selected(selectedCount)}</p>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            aria-label={p.nudgeLeft}
            className={nudgeBtn}
            onClick={() => dispatch({ type: 'translateSelected', dx: -1, dy: 0 })}
          >
            ←
          </button>
          <button
            type="button"
            aria-label={p.nudgeRight}
            className={nudgeBtn}
            onClick={() => dispatch({ type: 'translateSelected', dx: 1, dy: 0 })}
          >
            →
          </button>
          <button
            type="button"
            aria-label={p.nudgeUp}
            className={nudgeBtn}
            onClick={() => dispatch({ type: 'translateSelected', dx: 0, dy: -1 })}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={p.nudgeDown}
            className={nudgeBtn}
            onClick={() => dispatch({ type: 'translateSelected', dx: 0, dy: 1 })}
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'deleteSelected' })}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-red px-3 py-1.5 font-medium text-red-strong hover:bg-red/10"
        >
          {p.delete}
        </button>
      </div>
    );
  }

  if (!item) {
    return <p className="p-3 text-sm text-slate">{p.selectPrompt}</p>;
  }
  const set = (patch: Partial<DiagramItem>) => dispatch({ type: 'setItemProp', id: item.id, patch });

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {'color' in item && (
        <div>
          <span className="mb-1 block font-medium text-ink">{p.colour}</span>
          <div className="flex gap-1">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={p.colours[c]}
                aria-pressed={item.color === c}
                onClick={() => set({ color: c })}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md"
              >
                <span
                  className={`h-6 w-6 rounded-full border-2 ${
                    item.color === c ? 'border-ink' : 'border-transparent'
                  }`}
                  style={{ background: tokenColor(c) }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {item.type === 'player' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">{p.role}</span>
          <input
            value={item.label}
            maxLength={SCENE_LIMITS.labelLength}
            onChange={(e) => set({ label: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
      )}

      {item.type === 'player' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">{p.view}</span>
          <select
            value={item.view}
            onChange={(e) => set({ view: e.target.value as PlayerView })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            {PLAYER_VIEWS.map((v) => (
              <option key={v} value={v}>
                {p.views[v]}
              </option>
            ))}
          </select>
        </label>
      )}

      {item.type === 'player' && item.view === 'token' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">{p.shape}</span>
          <select
            value={item.shape}
            onChange={(e) => set({ shape: e.target.value as 'circle' | 'square' })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            <option value="circle">{p.circle}</option>
            <option value="square">{p.square}</option>
          </select>
        </label>
      )}

      {item.type === 'ball' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">{p.style}</span>
          <select
            value={item.style}
            onChange={(e) => set({ style: e.target.value as BallStyle })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            {BALL_STYLES.map((s) => (
              <option key={s} value={s}>
                {p.ballStyles[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      {item.type === 'text' && (
        <>
          <label className="block">
            <span className="mb-1 block font-medium text-ink">{p.text}</span>
            <input
              value={item.content}
              maxLength={SCENE_LIMITS.textLength}
              onChange={(e) => set({ content: e.target.value })}
              className="w-full rounded-md border border-border bg-surface px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-ink">{p.fontSize(item.fontSize)}</span>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={item.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </>
      )}

      {item.type === 'ladder' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">{p.rungs(item.rungs)}</span>
          <input
            type="range"
            min={3}
            max={10}
            value={item.rungs}
            onChange={(e) => set({ rungs: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      )}

      {item.type === 'arrow' && (
        <>
          <label className="block">
            <span className="mb-1 block font-medium text-ink">{p.style}</span>
            <select
              value={item.style}
              onChange={(e) => set({ style: e.target.value as 'pass' | 'shot' | 'run' })}
              className="w-full rounded-md border border-border bg-surface px-2 py-1"
            >
              <option value="pass">{p.arrowStyles.pass}</option>
              <option value="shot">{p.arrowStyles.shot}</option>
              <option value="run">{p.arrowStyles.run}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.curved}
              onChange={(e) => set({ curved: e.target.checked })}
              className="h-4 w-4 rounded-sm border-border text-blue-strong focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <span className="font-medium text-ink">{p.curved}</span>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-ink">{p.arrowhead}</span>
            <select
              value={item.head}
              onChange={(e) => set({ head: e.target.value as 'single' | 'double' })}
              className="w-full rounded-md border border-border bg-surface px-2 py-1"
            >
              <option value="single">{p.single}</option>
              <option value="double">{p.double}</option>
            </select>
          </label>
        </>
      )}

      {item.type === 'zoneLabel' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">{p.zone}</span>
          <select
            value={item.zone}
            onChange={(e) => set({ zone: Number(e.target.value) })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            {[1, 2, 3, 4, 5, 6].map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block font-medium text-ink">
          {p.size}
          {(item.type === 'line' || item.type === 'arrow') && (
            <span className="ml-1 font-normal text-slate">{p.scalesWidth}</span>
          )}
        </span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={item.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      {item.type !== 'ball' &&
        item.type !== 'pole' &&
        item.type !== 'line' &&
        item.type !== 'arrow' && (
          <label className="block">
            <span className="mb-1 block font-medium text-ink">{p.rotation}</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={item.rotation}
              onChange={(e) => set({ rotation: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          aria-label={p.nudgeLeft}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: -1, dy: 0 })}
        >
          ←
        </button>
        <button
          type="button"
          aria-label={p.nudgeRight}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: 1, dy: 0 })}
        >
          →
        </button>
        <button
          type="button"
          aria-label={p.nudgeUp}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: 0, dy: -1 })}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={p.nudgeDown}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: 0, dy: 1 })}
        >
          ↓
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'backward' })}
        >
          {p.back}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'forward' })}
        >
          {p.forward}
        </button>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'deleteItem', id: item.id })}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-red px-3 py-1.5 font-medium text-red-strong hover:bg-red/10"
      >
        {p.deleteElement}
      </button>
    </div>
  );
}
