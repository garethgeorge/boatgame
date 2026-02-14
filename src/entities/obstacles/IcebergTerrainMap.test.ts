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
        const result = map.sample(0, 0, waterHeight, 2.0);
        expect(result.y).toBeCloseTo(iceHeight);
        expect(result.zone).toBe('land');
    });

    it('should interpolate height when just outside the iceberg', () => {
        // At 1 unit from edge (dist = 1)
        // margin = 2.0
        // t = 1 / 2.0 = 0.5
        // y = 0.2 * (1 - 0.5) + (-1.0) * 0.5 = 0.1 - 0.5 = -0.4
        const result = map.sample(6, 0, waterHeight, 2.0);
        expect(result.y).toBeCloseTo(-0.4);
        expect(result.zone).toBe('margin');
    });

    it('should return water height when far from the iceberg', () => {
        // At 2 or more units from edge (dist >= margin)
        const result = map.sample(7, 0, waterHeight, 2.0);
        expect(result.y).toBeCloseTo(waterHeight);
        expect(result.zone).toBe('water');

        const resultFar = map.sample(100, 100, waterHeight, 2.0);
        expect(resultFar.y).toBeCloseTo(waterHeight);
        expect(resultFar.zone).toBe('water');
    });

    it('should return correct normal', () => {
        const result = map.sample(0, 0, waterHeight, 2.0);
        expect(result.normal.x).toBe(0);
        expect(result.normal.y).toBe(1);
        expect(result.normal.z).toBe(0);
    });
});
