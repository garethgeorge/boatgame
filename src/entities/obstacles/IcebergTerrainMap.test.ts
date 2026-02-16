import { describe, it, expect } from 'vitest';
import * as planck from 'planck';
import { IcebergTerrainMap } from './Iceberg';

describe('IcebergTerrainMap', () => {
    const vertices = [
        planck.Vec2(-5, -5),
        planck.Vec2(5, -5),
        planck.Vec2(5, 5),
        planck.Vec2(-5, 5)
    ];
    const iceHeight = 0.2;
    const waterHeight = -1.0;
    const map = new IcebergTerrainMap(vertices, iceHeight);

    it('should return ice height when inside the iceberg', () => {
        const zoneResult = map.zone(0, 0, 2.0, 0);
        const sampleResult = map.sample(0, 0);
        expect(sampleResult.y).toBeCloseTo(iceHeight);
        expect(zoneResult.zone).toBe('land');
    });

    it('should return margin zone when just outside the iceberg', () => {
        // At 1 unit from edge (dist = 1)
        // margin = 2.0
        // width = 2.0 (assumed from previous test context, but width is the new arg)
        // Wait, width is the margin region width.
        const result = map.zone(6, 0, 2.0, 2.0);
        expect(result.zone).toBe('margin');
    });

    it('should return water height when far from the iceberg', () => {
        const zoneResult = map.zone(10, 0, 2.0, 2.0);
        const sampleResult = map.sample(10, 0);
        expect(sampleResult.y).toBeCloseTo(0);
        expect(zoneResult.zone).toBe('water');
    });

    it('should return correct normal', () => {
        const result = map.sample(0, 0);
        expect(result.normal.x).toBe(0);
        expect(result.normal.y).toBe(1);
        expect(result.normal.z).toBe(0);
    });
});
