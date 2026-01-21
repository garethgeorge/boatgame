import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as planck from 'planck';
import * as THREE from 'three';
import { PlacementHelper } from './PlacementHelper';
import { RiverSystem } from '../world/RiverSystem';
import { SpatialGrid } from './SpatialGrid';

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
        const mockWorld = {
            queryAABB: vi.fn(),
        } as unknown as planck.World;

        placementHelper = new PlacementHelper(mockWorld, new SpatialGrid(20), mockRiverSystem);
    });

    describe('tryPlace', () => {
        const worldZ = 100;
        const radius = 5;
        const minDistFromBank = 2;

        it('should place exactly at center when range=[0, 0]', () => {
            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                range: [0, 0],
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(0);
        });

        it('should place exactly at left limit when range=[-1, -1]', () => {
            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                range: [-1, -1],
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(-43);
        });

        it('should place exactly at right limit when range=[1, 1]', () => {
            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                range: [1, 1],
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(43);
        });

        it('should stay within limits when using random ranges', () => {
            for (let i = 0; i < 50; i++) {
                const r1 = Math.random() * 2 - 1;
                const r2 = Math.random() * 2 - 1;
                const range: [number, number] = [Math.min(r1, r2), Math.max(r1, r2)];

                // @ts-ignore
                const localHelper = new PlacementHelper({ queryAABB: vi.fn() } as any, new SpatialGrid(20), mockRiverSystem);
                const pos = localHelper.tryPlace(worldZ, worldZ, radius, {
                    range,
                    minDistFromBank
                });

                expect(pos).not.toBeNull();
                expect(pos!.x).toBeGreaterThanOrEqual(-43.01);
                expect(pos!.x).toBeLessThanOrEqual(43.01);
            }
        });

        it('should respect river center offset', () => {
            mockRiverSystem.getRiverCenter.mockReturnValue(100);

            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                range: [0, 0],
                minDistFromBank
            });

            expect(pos).not.toBeNull();
            expect(pos!.x).toBe(100);
        });

        it('should return null if river is too narrow', () => {
            mockRiverSystem.getRiverWidth.mockReturnValue(10);

            const pos = placementHelper.tryPlace(worldZ, worldZ, radius, {
                range: [-1, 1],
                minDistFromBank
            });

            expect(pos).toBeNull();
        });

        it('should observe minDistFromOthers', () => {
            const pos1 = placementHelper.tryPlace(worldZ, worldZ, radius, {
                range: [0, 0],
                minDistFromOthers: 10
            });

            expect(pos1).not.toBeNull();

            const pos2 = placementHelper.tryPlace(worldZ, worldZ, radius, {
                range: [0, 0],
                minDistFromOthers: 10
            });

            expect(pos2).toBeNull();
        });

        it('should avoid center when avoidCenter is set', () => {
            for (let i = 0; i < 50; i++) {
                // @ts-ignore
                const localHelper = new PlacementHelper({ queryAABB: vi.fn() } as any, new SpatialGrid(20), mockRiverSystem);
                const pos = localHelper.tryPlace(worldZ, worldZ, radius, {
                    range: [-1, 1],
                    avoidCenter: 0.5, // Avoid [-0.5, 0.5] * safeHalfWidth
                    minDistFromBank
                });

                expect(pos).not.toBeNull();
                const absOffset = Math.abs(pos!.x);
                // safeHalfWidth is 43. 43 * 0.5 = 21.5
                expect(absOffset).toBeGreaterThanOrEqual(21.49);
                expect(absOffset).toBeLessThanOrEqual(43.01);
            }
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

    describe('two-grid-collision', () => {
        it('should collide with objects in masterGrid', () => {
            const masterGrid = new SpatialGrid(20);
            masterGrid.insert({
                position: new THREE.Vector3(10, 0, 100),
                groundRadius: 5,
                canopyRadius: 0,
            });
            const helper = new PlacementHelper({ queryAABB: vi.fn() } as any, masterGrid, mockRiverSystem);

            // Should collide with tree in masterGrid (x=0 vs x=10, dist=10, radiusSum=10, minDist=2, 10 < 12)
            const pos = helper.tryPlace(100, 100, 5, { range: [0, 0] });
            expect(pos).toBeNull();
        });

        it('should collide with objects in tempGrid', () => {
            const masterGrid = new SpatialGrid(20);
            const helper = new PlacementHelper({ queryAABB: vi.fn() } as any, masterGrid, mockRiverSystem);

            // Place something (goes into tempGrid)
            helper.registerPlacement(10, 100, 5);

            // Should collide with object in tempGrid
            const pos = helper.tryPlace(100, 100, 5, { range: [0, 0] });
            expect(pos).toBeNull();
        });

        it('should NOT add entity placements to masterGrid', () => {
            const masterGrid = new SpatialGrid(20);
            const helper = new PlacementHelper({ queryAABB: vi.fn() } as any, masterGrid, mockRiverSystem);

            helper.registerPlacement(10, 100, 5);

            // Verify masterGrid is still empty regarding this position
            expect(masterGrid.checkGroundCollision(10, 100, 5)).toBe(false);
        });
    });
});
