import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { WorldTerrainMap } from './WorldTerrainMap';
import { RiverSystem } from './RiverSystem';

vi.mock('./RiverSystem', () => ({
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
        expect(map.getZone(-15, 0, 2.0).zone).toBe('land');
        expect(map.getSurfaceInfo(-15, 0).y).toBe(10);

        expect(map.getZone(15, 0, 2.0).zone).toBe('land');
        expect(map.getSurfaceInfo(15, 0).y).toBe(10);
    });

    it('should return water zone when inside river', () => {
        expect(map.getZone(0, 0, 2.0).zone).toBe('water');
    });

    it('should return margin zone and correct t near edge', () => {
        // x=-9 is 1 unit inside left bank (-10). distance=1.
        // radius=2. t = 1/2 = 0.5
        const result = map.getZone(-9, 0, 2.0);
        expect(result.zone).toBe('margin');
        expect(result.t).toBeCloseTo(0.5);

        // x=-11 is 1 unit outside. distance=-1.
        // radius=2. t = -1/2 = -0.5
        const result2 = map.getZone(-11, 0, 2.0);
        expect(result2.zone).toBe('margin');
        expect(result2.t).toBeCloseTo(-0.5);
    });
});
