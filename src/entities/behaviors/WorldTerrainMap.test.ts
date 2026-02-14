import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { WorldTerrainMap } from './WorldTerrainMap';
import { RiverSystem } from '../../world/RiverSystem';

vi.mock('../../world/RiverSystem', () => ({
    RiverSystem: {
        getInstance: vi.fn()
    }
}));

describe('WorldTerrainMap', () => {
    const mockRiverSystem = {
        terrainGeometry: {
            calculateHeight: vi.fn((x: number, z: number) => 10),
            calculateNormal: vi.fn((x: number, z: number) => new THREE.Vector3(0, 1, 0)),
        },
        getBankPositions: vi.fn((z: number) => ({ left: -10, right: 10 })),
    };

    (RiverSystem.getInstance as any).mockReturnValue(mockRiverSystem);

    const map = WorldTerrainMap.getInstance();
    const waterHeight = 0;
    const margin = 2.0;

    it('should return land zone when outside river', () => {
        const resultL = map.sample(-15, 0, waterHeight, margin);
        expect(resultL.zone).toBe('land');
        expect(resultL.y).toBe(10);

        const resultR = map.sample(15, 0, waterHeight, margin);
        expect(resultR.zone).toBe('land');
        expect(resultR.y).toBe(10);
    });

    it('should return margin zone and interpolate height when near bank', () => {
        // x = -9 is 1 unit into water from left bank (-10)
        // t = 1 / 2 = 0.5
        // y = 10 * 0.5 + 0 * 0.5 = 5
        const result = map.sample(-9, 0, waterHeight, margin);
        expect(result.zone).toBe('margin');
        expect(result.y).toBeCloseTo(5);
    });

    it('should return water zone and water height when deep in river', () => {
        // x = 0 is 10 units from banks
        const result = map.sample(0, 0, waterHeight, margin);
        expect(result.zone).toBe('water');
        expect(result.y).toBe(0);
    });
});
