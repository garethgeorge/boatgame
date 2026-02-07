import { expect, test, describe } from 'vitest';
import { SpatialGrid, PlacementManifest } from './SpatialGrid';

describe('SpatialGrid', () => {
    test('insert and checkGroundCollision', () => {
        const grid = new SpatialGrid(10);
        const item: PlacementManifest = {
            x: 5,
            y: 0,
            z: 5,
            groundRadius: 2,
            canopyRadius: 0
        };
        grid.insert(item);

        // Direct hit
        expect(grid.checkGroundCollision(5, 5, 1)).toBe(true);
        // Near hit (within groundRadius + checkRadius = 2 + 1 = 3)
        expect(grid.checkGroundCollision(7.5, 5, 1)).toBe(true);
        // Just outside (dist = 3.1 > 3)
        expect(grid.checkGroundCollision(8.1, 5, 1)).toBe(false);
    });

    test('checkCollision with canopy', () => {
        const grid = new SpatialGrid(10);
        const item: PlacementManifest = {
            x: 5,
            y: 0,
            z: 5,
            groundRadius: 1,
            canopyRadius: 3
        };
        grid.insert(item);

        // Ground collision (dist = 1.5 < 1 + 1 = 2)
        expect(grid.checkCollision(6.5, 5, 1, 0)).toBe(true);
        // Canopy collision (dist = 4.5 < 3 + 2 = 5)
        expect(grid.checkCollision(9.5, 5, 0, 2)).toBe(true);
        // No collision (dist = 5.5 > 5)
        expect(grid.checkCollision(10.5, 5, 0, 2)).toBe(false);
    });

    test('checkCollision handles 0 canopy radius', () => {
        const grid = new SpatialGrid(10);
        const item: PlacementManifest = {
            x: 5,
            y: 0,
            z: 5,
            groundRadius: 2,
            canopyRadius: 0
        };
        grid.insert(item);

        // Ground collision
        expect(grid.checkCollision(6, 5, 2, 5)).toBe(true);
        // No canopy collision even if check radius is large because item.canopyRadius is 0
        expect(grid.checkCollision(10, 5, 0, 5)).toBe(false);
    });
});
