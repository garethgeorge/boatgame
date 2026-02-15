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
        // Banks at -10 and 10. x=-15 is 5 units outside bank.
        // margin=0, width=2. distance = -5.
        // -5 < margin - width (0 - 2 = -2), so zone is land.
        expect(map.zone(-15, 0, 0, 2).zone).toBe('land');
        expect(map.sample(-15, 0).y).toBe(10);

        expect(map.zone(15, 0, 0, 2).zone).toBe('land');
        expect(map.sample(15, 0).y).toBe(10);
    });

    it('should return water zone when inside river', () => {
        // x=0 is 10 units inside bank. margin=0.
        // distance=10 > margin=0, so zone is water.
        expect(map.zone(0, 0, 0, 2).zone).toBe('water');
    });

    it('should return margin zone and correct t near edge', () => {
        // x=-9 is 1 unit inside left bank (-10). distance=1.
        // margin=2, width=2.
        // distance=1 < margin=2 and distance=1 > margin-width=0.
        // so zone is margin.
        // t = (2 - 1) / 2 = 0.5
        const result = map.zone(-9, 0, 2, 2);
        expect(result.zone).toBe('margin');
        expect(result.t).toBeCloseTo(0.5);

        // x=-11 is 1 unit outside. distance=-1.
        // margin=0, width=2.
        // distance=-1 < margin-width=-2 is false.
        // distance=-1 > margin-width=-2 is true.
        // margin - distance / width = (0 - (-1)) / 2 = 0.5
        const result2 = map.zone(-11, 0, 0, 2);
        expect(result2.zone).toBe('margin');
        expect(result2.t).toBeCloseTo(0.5);
    });
});
