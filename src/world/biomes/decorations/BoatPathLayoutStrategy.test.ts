import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { RiverSystem } from '../../RiverSystem';
import { EntityIds } from '../../../entities/EntityIds';
import { EntityRules } from './EntityLayoutRules';
import { Patterns } from './BoatPathLayoutPatterns';
import { RiverGeometry } from '../../RiverGeometry';

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
        const scatterOpts = {
            place: 'path' as any,
            density: [10, 10] as [number, number],
            entity: EntityRules.rock('test')
        };
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
                                patterns: ['scatter']
                            }]
                        }
                    ]
                }
            ],
            patterns: {
                scatter: Patterns.scatter(scatterOpts)
            },
            path: { length: [10, 20] as [number, number] }
        };

        const layout = BoatPathLayoutStrategy.createLayout([0, 100], config as any);

        expect(layout.placements.length).toBeGreaterThan(0);
        layout.placements.forEach(p => {
            expect(p.offset).toBeDefined();
            expect(typeof p.offset).toBe('number');
            expect((p as any).range).toBeUndefined();
            expect(p.entity.radius).toBeGreaterThan(0);
        });
    });

    it('should prevent overlapping placements using SpatialGrid', () => {
        const sequenceOpts = {
            place: 'path' as any,
            density: [100, 100] as [number, number],
            entity: EntityRules.rock('test')
        };
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
                                patterns: ['sequence']
                            }]
                        }
                    ]
                }
            ],
            patterns: {
                sequence: Patterns.sequence(sequenceOpts)
            },
            path: { length: [10, 20] as [number, number] }
        };

        const layout = BoatPathLayoutStrategy.createLayout([0, 100], config as any);

        // Check for collisions between any two placements
        for (let i = 0; i < layout.placements.length; i++) {
            for (let j = i + 1; j < layout.placements.length; j++) {
                const p1 = layout.placements[i];
                const p2 = layout.placements[j];

                const s1 = RiverGeometry.getPathPoint(layout.path, p1.index);
                const s2 = RiverGeometry.getPathPoint(layout.path, p2.index);

                const x1 = s1.centerPos.x + s1.normal.x * p1.offset;
                const z1 = s1.centerPos.z + s1.normal.z * p1.offset;
                const x2 = s2.centerPos.x + s2.normal.x * p2.offset;
                const z2 = s2.centerPos.z + s2.normal.z * p2.offset;

                const dx = x1 - x2;
                const dz = z1 - z2;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Allow a tiny epsilon for floating point
                expect(dist).toBeGreaterThanOrEqual(p1.entity.radius + p2.entity.radius - 0.01);
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
                        { name: 'b1', at: 0.5, range: [0.1, 0.2] as [number, number], type: EntityIds.BOTTLE }
                    ]
                }
            ],
            patterns: {},
            path: { length: [10, 20] as [number, number] }
        };

        const layout = BoatPathLayoutStrategy.createLayout([0, 100], config as any);

        const bottle = layout.placements.find(p => p.entity.config.id === EntityIds.BOTTLE);
        expect(bottle).toBeDefined();
        expect(bottle!.offset).toBeDefined();
    });
});
