
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoatPathLayoutStrategy, BoatPathLayoutConfig } from './BoatPathLayoutStrategy';
import { RiverSystem } from '../RiverSystem';
import { EntityIds } from '../../entities/EntityIds';

vi.mock('../RiverSystem', () => ({
    RiverSystem: {
        getInstance: vi.fn(() => ({
            getRiverCenter: vi.fn(() => 0),
            getRiverDerivative: vi.fn(() => 0),
            getRiverWidth: vi.fn(() => 50),
            biomeManager: {
                getRiverWidthMultiplier: vi.fn(() => 1.0)
            }
        }))
    }
}));

describe('BoatPathLayoutStrategy', () => {
    const mockConfig: BoatPathLayoutConfig = {
        patterns: {
            'test_pattern': {
                logic: 'scatter',
                place: 'slalom',
                density: [1.0, 1.0],
                types: [EntityIds.ROCK]
            }
        },
        tracks: [
            {
                name: 'main',
                stages: [
                    {
                        name: 'intro',
                        progress: [0, 1.0],
                        scenes: [
                            { length: [50, 100], patterns: ['test_pattern'] }
                        ]
                    }
                ]
            }
        ],
        waterAnimals: [],
        path: {
            length: [100, 100]
        }
    };

    it('should generate a layout with path and placements', () => {
        const zMin = 0;
        const zMax = 500;
        const layout = BoatPathLayoutStrategy.createLayout(zMin, zMax, mockConfig);

        expect(layout).toBeDefined();
        expect(layout.path.length).toBeGreaterThan(0);
        expect(layout.placements.length).toBeGreaterThan(0);

        // Check weaving was applied
        const hasWeaving = layout.path.some(p => p.boatXOffset !== 0);
        expect(hasWeaving).toBe(true);

        // Check placements were generated and have a type
        expect(layout.placements[0].type).toBe(EntityIds.ROCK);
    });

    it('should generate placements within the entire range', () => {
        const zMin = 0;
        const zMax = 1000;
        const layout = BoatPathLayoutStrategy.createLayout(zMin, zMax, mockConfig);

        // The total arc length should be approximately 1000
        const totalArc = layout.path[layout.path.length - 1].arcLength;
        expect(totalArc).toBeCloseTo(1000, 0);

        // Check that some placements are near the end
        const hasEndPlacements = layout.placements.some(p => p.index > (layout.path.length * 0.8));
        expect(hasEndPlacements).toBe(true);
    });
});
