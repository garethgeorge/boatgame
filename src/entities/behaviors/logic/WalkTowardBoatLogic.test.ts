import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as planck from 'planck';
import * as THREE from 'three';
import { WalkTowardBoatLogic } from './WalkTowardBoatLogic';
import { AnimalLogicContext } from './AnimalLogic';

describe('WalkTowardBoatLogic', () => {
    let mockContext: any;
    let mockTerrainMap: any;

    beforeEach(() => {
        mockTerrainMap = {
            sample: vi.fn()
        };

        mockContext = {
            targetBody: {
                getPosition: vi.fn(() => planck.Vec2(100, 100))
            },
            physicsBody: {
                getPosition: vi.fn(() => planck.Vec2(50, 50)) // World Pos
            },
            animal: {
                getTerrainMap: vi.fn(() => mockTerrainMap),
                localPos: vi.fn(() => new THREE.Vector3(0, 0, 0)) // Local Pos
            }
        };
    });

    it('should continue walking when on land', () => {
        mockTerrainMap.sample.mockReturnValue({ zone: 'land' });
        const logic = new WalkTowardBoatLogic({ speed: 5 });
        const result = logic.update(mockContext as AnimalLogicContext);

        expect(result.finish).toBeUndefined();
        expect(result.path.speed).toBe(5);
        expect(result.path.locomotionType).toBe('LAND');
        expect(mockTerrainMap.sample).toHaveBeenCalledWith(0, 0, 0, 2.0);
    });

    it('should continue walking when in margin', () => {
        mockTerrainMap.sample.mockReturnValue({ zone: 'margin' });
        const logic = new WalkTowardBoatLogic({ speed: 5 });
        const result = logic.update(mockContext as AnimalLogicContext);

        expect(result.finish).toBeUndefined();
    });

    it('should finish when in water', () => {
        mockTerrainMap.sample.mockReturnValue({ zone: 'water' });
        const logic = new WalkTowardBoatLogic({ speed: 5 });
        const result = logic.update(mockContext as AnimalLogicContext);

        expect(result.finish).toBe(true);
        expect(result.result).toBe(WalkTowardBoatLogic.RESULT_FINISHED);
        expect(mockTerrainMap.sample).toHaveBeenCalledWith(0, 0, 0, 2.0);
    });
});
