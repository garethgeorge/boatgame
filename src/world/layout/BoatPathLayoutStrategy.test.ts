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

        const layout = BoatPathLayoutStrategy.createLayout([0, 100], config as any, new SpatialGrid(20));

        expect(layout.placements.length).toBeGreaterThan(0);
        layout.placements.forEach(p => {
            expect(p.x).toBeDefined();
            expect(p.z).toBeDefined();
            expect((p as any).range).toBeUndefined();
            expect(p.groundRadius).toBeGreaterThan(0);
        });
    });

    it('should prevent overlapping placements using SpatialGrid', () => {
        const sequencePattern = Patterns.sequence({
            placement: Placements.path({
                entity: RiverRockRule.get('test')
            }),
            density: [100, 100] as [number, number],
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
                                patterns: [sequencePattern]
                            }]
                        }
                    ]
                }
            ],
            path: { length: [10, 20] as [number, number] }
        };

        const layout = BoatPathLayoutStrategy.createLayout([0, 100], config as any, new SpatialGrid(20));

        // Check for collisions between any two placements
        for (let i = 0; i < layout.placements.length; i++) {
            for (let j = i + 1; j < layout.placements.length; j++) {
                const p1 = layout.placements[i];
                const p2 = layout.placements[j];

                const s1 = RiverGeometry.getPathPoint(layout.path, p1.index);
                const s2 = RiverGeometry.getPathPoint(layout.path, p2.index);

                const x1 = p1.x;
                const z1 = p1.z;
                const x2 = p2.x;
                const z2 = p2.z;

                const dx = x1 - x2;
                const dz = z1 - z2;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Allow a tiny epsilon for floating point
                expect(dist).toBeGreaterThanOrEqual(p1.groundRadius + p2.groundRadius - 0.01);
            }
        }
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

        const layout = BoatPathLayoutStrategy.createLayout([0, 100], config as any, new SpatialGrid(20));

        const bottle = layout.placements.find(p => p.id === EntityIds.BOTTLE);
        expect(bottle).toBeDefined();
        expect(bottle!.x).toBeDefined();
    });
});
