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
    const dummyEntity = { physicsBodies: [], meshes: [] } as any;
    const map = new IcebergTerrainMap(dummyEntity, vertices, iceHeight);

    it('should return ice height when inside the iceberg', () => {
        const sampleResult = map.getSurfaceInfo(0, 0);
        expect(sampleResult.y).toBeCloseTo(iceHeight);
        expect(sampleResult.zone).toBe('land');
    });

    it('should return margin zone when just outside the iceberg', () => {
        // At 1 unit from edge (dist = 1) -> outside iceberg means water. signedWaterDistance = 1.
        const result = map.getZone(6, 0, 2.0);
        expect(result.zone).toBe('margin');
        expect(result.t).toBeCloseTo(0.5);
    });

    it('should return water height when far from the iceberg', () => {
        const zoneResult = map.getZone(10, 0, 2.0);
        const sampleResult = map.getSurfaceInfo(10, 0);
        expect(sampleResult.y).toBeCloseTo(0);
        expect(zoneResult.zone).toBe('water');
    });

    it('should return correct normal', () => {
        const result = map.getSurfaceInfo(0, 0);
        expect(result.normal.x).toBe(0);
        expect(result.normal.y).toBe(1);
        expect(result.normal.z).toBe(0);
    });
});
