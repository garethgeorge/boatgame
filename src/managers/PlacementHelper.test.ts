import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PlacementHelper } from './PlacementHelper';
import { RiverSystem } from '../world/RiverSystem';

// Mock RiverSystem
vi.mock('../world/RiverSystem', () => {
    const mockRiverSystem = {
        getRiverCenter: vi.fn().mockReturnValue(0),
        getRiverWidth: vi.fn().mockReturnValue(100),
        getRiverDerivative: vi.fn().mockReturnValue(0),
        terrainGeometry: {
            calculateHeight: vi.fn().mockReturnValue(10),
            calculateNormal: vi.fn().mockReturnValue(new THREE.Vector3(0, 1, 0)),
        }
    };
    return {
        RiverSystem: {
            getInstance: vi.fn().mockReturnValue(mockRiverSystem),
        },
    };
});

describe('PlacementHelper', () => {
    let placementHelper: PlacementHelper;
    let mockRiverSystem: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRiverSystem = RiverSystem.getInstance();
        mockRiverSystem.getRiverCenter.mockReturnValue(0);
        mockRiverSystem.getRiverWidth.mockReturnValue(100);
        mockRiverSystem.getRiverDerivative.mockReturnValue(0);
        mockRiverSystem.terrainGeometry.calculateHeight.mockReturnValue(10);
        mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(new THREE.Vector3(0, 1, 0));
        placementHelper = new PlacementHelper();
    });

    describe('tryPlace', () => {
        const worldZ = 100;
        const radius = 5;
        const minDistFromBank = 2;

        it('should place exactly at center when center=0 and variation=0', () => {
            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                center: 0,
                variation: 0,
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(0);
        });

        it('should place exactly at left limit when center=-1 and variation=0', () => {
            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                center: -1,
                variation: 0,
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(-43);
        });

        it('should place exactly at right limit when center=1 and variation=0', () => {
            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                center: 1,
                variation: 0,
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(43);
        });

        it('should stay within limits when variation is high', () => {
            for (let i = 0; i < 50; i++) {
                const center = Math.random() * 2 - 1;
                const variation = Math.random();

                const localHelper = new PlacementHelper();
                const pos = localHelper.tryPlace(worldZ, worldZ, radius, {
                    center,
                    variation,
                    minDistFromBank
                });

                expect(pos).not.toBeNull();
                expect(pos!.x).toBeGreaterThanOrEqual(-43);
                expect(pos!.x).toBeLessThanOrEqual(43);
            }
        });

        it('should respect river center offset', () => {
            mockRiverSystem.getRiverCenter.mockReturnValue(100);

            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                center: 0,
                variation: 0,
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(100);
        });

        it('should return null if river is too narrow', () => {
            mockRiverSystem.getRiverWidth.mockReturnValue(10);

            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                center: 0,
                variation: 1,
                minDistFromBank
            });

            expect(pos).toBeNull();
        });

        it('should observe minDistFromOthers', () => {
            const pos1 = placementHelper.tryPlace(worldZ, worldZ, radius, {
                center: 0,
                variation: 0,
                minDistFromOthers: 10
            });

            expect(pos1).not.toBeNull();

            const pos2 = placementHelper.tryPlace(worldZ, worldZ, radius, {
                center: 0,
                variation: 0,
                minDistFromOthers: 10
            });

            expect(pos2).toBeNull();
        });
    });

    describe('findShorePlacement', () => {
        const zStart = 0;
        const zEnd = 100;

        it('should always place on left when side=-1', () => {
            for (let i = 0; i < 20; i++) {
                const placement = placementHelper.findShorePlacement(zStart, zEnd, mockRiverSystem, {
                    side: -1,
                    minDistFromBank: 0,
                    maxDistFromBank: 0
                });
                expect(placement).not.toBeNull();
                expect(placement!.worldX).toBe(-50);
            }
        });

        it('should always place on right when side=1', () => {
            for (let i = 0; i < 20; i++) {
                const placement = placementHelper.findShorePlacement(zStart, zEnd, mockRiverSystem, {
                    side: 1,
                    minDistFromBank: 0,
                    maxDistFromBank: 0
                });
                expect(placement).not.toBeNull();
                expect(placement!.worldX).toBe(50);
            }
        });

        it('should place 50/50 when side=0', () => {
            let leftCount = 0;
            const iterations = 100;
            for (let i = 0; i < iterations; i++) {
                const placement = placementHelper.findShorePlacement(zStart, zEnd, mockRiverSystem, {
                    side: 0,
                    minDistFromBank: 0,
                    maxDistFromBank: 0
                });
                if (placement!.worldX < 0) leftCount++;
            }
            expect(leftCount).toBeGreaterThan(30);
            expect(leftCount).toBeLessThan(70);
        });

        it('should respect probability when side is between 0 and 1', () => {
            let rightCount = 0;
            const iterations = 100;
            const side = 0.8;
            for (let i = 0; i < iterations; i++) {
                const placement = placementHelper.findShorePlacement(zStart, zEnd, mockRiverSystem, {
                    side,
                    minDistFromBank: 0,
                    maxDistFromBank: 0
                });
                if (placement!.worldX > 0) rightCount++;
            }
            expect(rightCount).toBeGreaterThan(60);
        });

        it('should respect minDistFromBank and maxDistFromBank', () => {
            const placement = placementHelper.findShorePlacement(zStart, zEnd, mockRiverSystem, {
                side: 1,
                minDistFromBank: 10,
                maxDistFromBank: 10
            });
            expect(placement!.worldX).toBe(60);
        });
    });
});
