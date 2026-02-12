import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { RiverSystem } from '../RiverSystem';
import { EntityIds } from '../../entities/EntityIds';
import { LayoutRules } from './LayoutRuleBuilders';
import { Placements, Patterns } from './BoatPathLayoutPatterns';
import { RiverGeometry } from '../RiverGeometry';
import { RiverRockRule, BottleRule } from '../../entities/StaticLayoutRules';
import { SpatialGrid } from '../../core/SpatialGrid';

describe('BoatPathLayoutStrategy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock RiverSystem
        const mockRiver = {
            getRiverCenter: vi.fn().mockReturnValue(0),
            getRiverDerivative: vi.fn().mockReturnValue(0),
            getRiverWidth: vi.fn().mockReturnValue(50),
            biomeManager: {
                getRiverWidthMultiplier: vi.fn().mockReturnValue(1.0),
                getAmplitudeMultiplier: vi.fn().mockReturnValue(1.0)
            },
            terrainGeometry: {
                calculateHeight: vi.fn().mockReturnValue(0),
                calculateNormal: vi.fn().mockReturnValue({ x: 0, y: 1, z: 0 })
            }
        };
        vi.spyOn(RiverSystem, 'getInstance').mockReturnValue(mockRiver as any);
    });

    it('should generate a layout with explicit offsets and no ranges', () => {
        const scatterPattern = Patterns.scatter({
            placement: Placements.path({
                entity: RiverRockRule.get('test')
            }),
            density: [10, 10] as [number, number],
        });

        const config = {
            biomeType: 'happy',
            difficulty: 1,
            tracks: [
                {
                    name: 'main',
                    stages: [
                        {
                            name: 's1',
                            progress: [0, 1] as [number, number],
                            scenes: [{
                                length: [100, 100] as [number, number],
                                patterns: [scatterPattern]
                            }]
                        }
                    ]
                }
            ],
            path: { length: [10, 20] as [number, number] }
        };

        const world: any = {
            biomeZRange: [0, 100],
            riverSystem: RiverSystem.getInstance(),
            terrainProvider: () => ({ height: 0, slope: 0, distToRiver: 0 }),
            random: vi.fn().mockReturnValue(0.5)
        };
        const layout = BoatPathLayoutStrategy.createLayout(world, config as any, new SpatialGrid(20));

        expect(layout.placements.length).toBeGreaterThan(0);
        layout.placements.forEach(p => {
            expect(p.x).toBeDefined();
            expect(p.z).toBeDefined();
            expect((p as any).range).toBeUndefined();
        });
    });

    it('should support explicit placements with offsets', () => {
        const config = {
            biomeType: 'happy',
            difficulty: 1,
            tracks: [
                {
                    name: 'unique',
                    placements: [
                        {
                            name: 'b1', at: 0.5,
                            placement: Placements.path({
                                entity: BottleRule.get()
                            })
                        }
                    ]
                }
            ],
            path: { length: [10, 20] as [number, number] }
        };

        const world: any = {
            biomeZRange: [0, 100],
            riverSystem: RiverSystem.getInstance(),
            terrainProvider: () => ({ height: 0, slope: 0, distToRiver: 0 }),
            random: vi.fn().mockReturnValue(0.5)
        };
        const layout = BoatPathLayoutStrategy.createLayout(world, config as any, new SpatialGrid(20));

        const bottle = layout.placements.find(p => p.id === EntityIds.BOTTLE);
        expect(bottle).toBeDefined();
        expect(bottle!.x).toBeDefined();
    });
});
