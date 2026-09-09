import type { Dispatch } from 'react';
import { PALETTE_COLORS, SCENE_LIMITS, type DiagramItem } from '../types/diagram';
import { tokenColor } from './tokenColor';
import type { EditorAction } from './useDiagramEditor';

interface Props {
  item: DiagramItem | null;
  dispatch: Dispatch<EditorAction>;
}

export function PropertiesPanel({ item, dispatch }: Props) {
  if (!item) {
    return <p className="p-3 text-sm text-slate">Select an element to edit its properties.</p>;
  }
  const set = (patch: Partial<DiagramItem>) => dispatch({ type: 'setItemProp', id: item.id, patch });

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {'color' in item && (
        <div>
          <span className="mb-1 block font-medium text-ink">Colour</span>
          <div className="flex gap-1">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={item.color === c}
                onClick={() => set({ color: c })}
                className={`h-6 w-6 rounded-full border-2 ${
                  item.color === c ? 'border-ink' : 'border-transparent'
                }`}
                style={{ background: tokenColor(c) }}
              />
            ))}
          </div>
        </div>
      )}

      {item.type === 'player' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Role</span>
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
          <span className="mb-1 block font-medium text-ink">Shape</span>
          <select
            value={item.shape}
            onChange={(e) => set({ shape: e.target.value as 'circle' | 'square' })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            <option value="circle">Circle</option>
            <option value="square">Square</option>
          </select>
        </label>
      )}

      {item.type === 'text' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Text</span>
          <input
            value={item.content}
            maxLength={SCENE_LIMITS.textLength}
            onChange={(e) => set({ content: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
      )}

      {item.type === 'ladder' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Rungs: {item.rungs}</span>
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
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Style</span>
          <select
            value={item.style}
            onChange={(e) => set({ style: e.target.value as 'pass' | 'shot' | 'run' })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            <option value="pass">Pass</option>
            <option value="shot">Shot</option>
            <option value="run">Run</option>
          </select>
        </label>
      )}

      {item.type === 'zoneLabel' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Zone</span>
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
        <span className="mb-1 block font-medium text-ink">Size</span>
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
            <span className="mb-1 block font-medium text-ink">Rotation</span>
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
          className="rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x - 1, y: item.y })}
        >
          ←
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x + 1, y: item.y })}
        >
          →
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x, y: item.y - 1 })}
        >
          ↑
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1"
          onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x, y: item.y + 1 })}
        >
          ↓
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'backward' })}
        >
          Back
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'forward' })}
        >
          Forward
        </button>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'deleteItem', id: item.id })}
        className="rounded-md border border-red px-3 py-1.5 font-medium text-red hover:bg-red/10"
      >
        Delete element
      </button>
    </div>
  );
}
