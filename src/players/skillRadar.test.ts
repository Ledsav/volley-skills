import { describe, expect, it } from 'vitest';
import { buildSkillRadar } from './skillRadar';

describe('buildSkillRadar', () => {
  it('places one axis per score, starting straight up and going clockwise', () => {
    const geometry = buildSkillRadar([10, null, null, null, null, null, null, null], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

    expect(geometry.axisLabels).toHaveLength(8);
    expect(geometry.axisLabels[0].label).toBe('A');
    // Straight up from center: same x as center, smaller y.
    expect(geometry.axisLabels[0].x).toBeCloseTo(geometry.center, 1);
    expect(geometry.axisLabels[0].y).toBeLessThan(geometry.center);
  });

  it('plots a full score at the outer edge and a null score at the centre', () => {
    const geometry = buildSkillRadar([10, null], ['A', 'B']);

    const [max, nullPoint] = geometry.valuePoints;
    expect(Math.hypot(max.x - geometry.center, max.y - geometry.center)).toBeCloseTo(geometry.maxRadius, 1);
    expect(nullPoint).toEqual({ x: geometry.center, y: geometry.center });
  });

  it('clamps out-of-range scores to the max radius', () => {
    const geometry = buildSkillRadar([15], ['A']);
    const [point] = geometry.valuePoints;
    expect(Math.hypot(point.x - geometry.center, point.y - geometry.center)).toBeCloseTo(geometry.maxRadius, 1);
  });

  it('builds one grid ring per level and a polygon string with one vertex per axis', () => {
    const geometry = buildSkillRadar([5, 5, 5, 5], ['A', 'B', 'C', 'D']);

    expect(geometry.gridPolygons).toHaveLength(4);
    expect(geometry.polygonPoints.split(' ')).toHaveLength(4);
  });

  it('anchors labels away from the centre so text does not overlap the chart', () => {
    const geometry = buildSkillRadar([5, 5, 5, 5], ['Top', 'Right', 'Bottom', 'Left']);

    expect(geometry.axisLabels[0].textAnchor).toBe('middle'); // top
    expect(geometry.axisLabels[1].textAnchor).toBe('start'); // right
    expect(geometry.axisLabels[2].textAnchor).toBe('middle'); // bottom
    expect(geometry.axisLabels[3].textAnchor).toBe('end'); // left
  });
});
