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
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-surface-2 px-2 py-1 text-ink hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';



export function PropertiesPanel({ item, dispatch, selectedCount }: Props) {
  const p = useT().diagrams.properties;
  if (selectedCount > 1) {
    return (
      <div className="flex flex-col gap-3 p-3 text-callout">
        <p className="text-headline text-ink">{p.selected(selectedCount)}</p>
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
          className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1.5 font-semibold text-red-strong hover:bg-red-tint"
        >
          {p.delete}
        </button>
      </div>
    );
  }

  if (!item) {
    return <p className="p-3 text-callout text-ink-2">{p.selectPrompt}</p>;
  }
  const set = (patch: Partial<DiagramItem>) => dispatch({ type: 'setItemProp', id: item.id, patch });

  return (
    <div className="flex flex-col gap-3 p-3 text-callout">
      {'color' in item && (
        <div>
          <span className="mb-1 block text-caption text-ink-2">{p.colour}</span>
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
                  className={`h-6 w-6 rounded-full border border-ink/20 ${
                    item.color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
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
          <span className="mb-1 block text-caption text-ink-2">{p.role}</span>
          <input
            value={item.label}
            maxLength={SCENE_LIMITS.labelLength}
            onChange={(e) => set({ label: e.target.value })}
            className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
          />
        </label>
      )}

      {item.type === 'player' && (
        <label className="block">
          <span className="mb-1 block text-caption text-ink-2">{p.view}</span>
          <select
            value={item.view}
            onChange={(e) => set({ view: e.target.value as PlayerView })}
            className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
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
          <span className="mb-1 block text-caption text-ink-2">{p.shape}</span>
          <select
            value={item.shape}
            onChange={(e) => set({ shape: e.target.value as 'circle' | 'square' })}
            className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
          >
            <option value="circle">{p.circle}</option>
            <option value="square">{p.square}</option>
          </select>
        </label>
      )}

      {item.type === 'ball' && (
        <label className="block">
          <span className="mb-1 block text-caption text-ink-2">{p.style}</span>
          <select
            value={item.style}
            onChange={(e) => set({ style: e.target.value as BallStyle })}
            className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
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
            <span className="mb-1 block text-caption text-ink-2">{p.text}</span>
            <input
              value={item.content}
              maxLength={SCENE_LIMITS.textLength}
              onChange={(e) => set({ content: e.target.value })}
              className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption text-ink-2">{p.fontSize(item.fontSize)}</span>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={item.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })}
              className="w-full accent-[rgb(var(--color-ink))]"
            />
          </label>
        </>
      )}

      {item.type === 'ladder' && (
        <label className="block">
          <span className="mb-1 block text-caption text-ink-2">{p.rungs(item.rungs)}</span>
          <input
            type="range"
            min={3}
            max={10}
            value={item.rungs}
            onChange={(e) => set({ rungs: Number(e.target.value) })}
            className="w-full accent-[rgb(var(--color-ink))]"
          />
        </label>
      )}

      {item.type === 'arrow' && (
        <>
          <label className="block">
            <span className="mb-1 block text-caption text-ink-2">{p.style}</span>
            <select
              value={item.style}
              onChange={(e) => set({ style: e.target.value as 'pass' | 'shot' | 'run' })}
              className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
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
              className="h-4 w-4 accent-[rgb(var(--color-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <span className="text-callout text-ink">{p.curved}</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-caption text-ink-2">{p.arrowhead}</span>
            <select
              value={item.head}
              onChange={(e) => set({ head: e.target.value as 'single' | 'double' })}
              className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
            >
              <option value="single">{p.single}</option>
              <option value="double">{p.double}</option>
            </select>
          </label>
        </>
      )}

      {item.type === 'zoneLabel' && (
        <label className="block">
          <span className="mb-1 block text-caption text-ink-2">{p.zone}</span>
          <select
            value={item.zone}
            onChange={(e) => set({ zone: Number(e.target.value) })}
            className="min-h-11 w-full rounded-md bg-surface-2 px-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
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
        <span className="mb-1 block text-caption text-ink-2">
          {p.size}
          {(item.type === 'line' || item.type === 'arrow') && (
            <span className="ml-1 text-ink-2">{p.scalesWidth}</span>
          )}
        </span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={item.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="w-full accent-[rgb(var(--color-ink))]"
        />
      </label>

      {item.type !== 'ball' &&
        item.type !== 'pole' &&
        item.type !== 'line' &&
        item.type !== 'arrow' && (
          <label className="block">
            <span className="mb-1 block text-caption text-ink-2">{p.rotation}</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={item.rotation}
              onChange={(e) => set({ rotation: Number(e.target.value) })}
              className="w-full accent-[rgb(var(--color-ink))]"
            />
          </label>
        )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          aria-label={p.nudgeLeft}
          className={nudgeBtn}
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: -1, dy: 0 })}
        >
          ←
        </button>
        <button
          type="button"
          aria-label={p.nudgeRight}
          className={nudgeBtn}
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: 1, dy: 0 })}
        >
          →
        </button>
        <button
          type="button"
          aria-label={p.nudgeUp}
          className={nudgeBtn}
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: 0, dy: -1 })}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={p.nudgeDown}
          className={nudgeBtn}
          onClick={() => dispatch({ type: 'translateItem', id: item.id, dx: 0, dy: 1 })}
        >
          ↓
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={`${nudgeBtn} text-footnote`}
          onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'backward' })}
        >
          {p.back}
        </button>
        <button
          type="button"
          className={`${nudgeBtn} text-footnote`}
          onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'forward' })}
        >
          {p.forward}
        </button>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'deleteItem', id: item.id })}
        className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1.5 font-semibold text-red-strong hover:bg-red-tint"
      >
        {p.deleteElement}
      </button>
    </div>
  );
}
