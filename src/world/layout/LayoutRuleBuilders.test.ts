import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { LayoutRules } from './LayoutRuleBuilders';

describe('LayoutRules', () => {
    describe('slope_in_range', () => {
        const mockRiverSystem = {
            terrainGeometry: {
                calculateNormal: vi.fn()
            }
        };

        const createCtx = (x: number, z: number) => ({
            riverSystem: mockRiverSystem,
            x, z,
            habitat: 'land'
        });

        it('should correctly filter based on degrees (0-20 range)', () => {
            const slope10 = LayoutRules.slope_in_range(0, 20);

            // Case 1: 0 degrees (upright) -> should be true
            mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(new THREE.Vector3(0, 1, 0));
            expect(slope10(createCtx(0, 0) as any, 0)).toBe(true);

            // Case 2: 10 degrees -> should be true
            // Normal at 10 degrees from UP
            const angle10Rad = 10 * Math.PI / 180;
            const normal10 = new THREE.Vector3(Math.sin(angle10Rad), Math.cos(angle10Rad), 0).normalize();
            mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(normal10);
            expect(slope10(createCtx(1, 0) as any, 0)).toBe(true);

            // Case 3: 45 degrees -> should be false
            const angle45Rad = 45 * Math.PI / 180;
            const normal45 = new THREE.Vector3(Math.sin(angle45Rad), Math.cos(angle45Rad), 0).normalize();
            mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(normal45);
            expect(slope10(createCtx(2, 0) as any, 0)).toBe(false);

            // Case 4: 20 degrees (boundary) -> should be true
            const angle20Rad = 20 * Math.PI / 180;
            const normal20 = new THREE.Vector3(Math.sin(angle20Rad), Math.cos(angle20Rad), 0).normalize();
            mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(normal20);
            expect(slope10(createCtx(3, 0) as any, 0)).toBe(true);

            // Case 5: 20.1 degrees -> should be false
            const angle20_1Rad = 20.1 * Math.PI / 180;
            const normal20_1 = new THREE.Vector3(Math.sin(angle20_1Rad), Math.cos(angle20_1Rad), 0).normalize();
            mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(normal20_1);
            expect(slope10(createCtx(4, 0) as any, 0)).toBe(false);
        });

        it('should correctly filter based on degrees (40-50 range)', () => {
            const slope45 = LayoutRules.slope_in_range(40, 50);

            // 45 degrees -> true
            const angle45Rad = 45 * Math.PI / 180;
            const normal45 = new THREE.Vector3(Math.sin(angle45Rad), Math.cos(angle45Rad), 0).normalize();
            mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(normal45);
            expect(slope45(createCtx(0, 0) as any, 0)).toBe(true);

            // 0 degrees -> false
            mockRiverSystem.terrainGeometry.calculateNormal.mockReturnValue(new THREE.Vector3(0, 1, 0));
            expect(slope45(createCtx(1, 0) as any, 0)).toBe(false);
        });
    });
});
