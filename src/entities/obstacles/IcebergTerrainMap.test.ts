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
        const result = map.sample(0, 0, waterHeight);
        expect(result.y).toBeCloseTo(iceHeight);
    });

    it('should interpolate height when just outside the iceberg', () => {
        // At 1 unit from edge (dist = 1)
        // t = min(1.0, 1 / 2.0) = 0.5
        // y = 0.2 * (1 - 0.5) + (-1.0) * 0.5 = 0.1 - 0.5 = -0.4
        const result = map.sample(6, 0, waterHeight);
        expect(result.y).toBeCloseTo(-0.4);
    });

    it('should return water height when far from the iceberg', () => {
        // At 2 or more units from edge (dist >= 2)
        // t = 1.0
        // y = waterHeight
        const result = map.sample(7, 0, waterHeight);
        expect(result.y).toBeCloseTo(waterHeight);

        const resultFar = map.sample(100, 100, waterHeight);
        expect(resultFar.y).toBeCloseTo(waterHeight);
    });

    it('should return correct normal', () => {
        const result = map.sample(0, 0, waterHeight);
        expect(result.normal.x).toBe(0);
        expect(result.normal.y).toBe(1);
        expect(result.normal.z).toBe(0);
    });
});
