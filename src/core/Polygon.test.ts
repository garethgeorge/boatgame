import { describe, it, expect } from 'vitest';
import * as planck from 'planck';
import { Polygon } from './Polygon';

describe('Polygon', () => {
    const square = new Polygon([
        planck.Vec2(0, 0),
        planck.Vec2(10, 0),
        planck.Vec2(10, 10),
        planck.Vec2(0, 10)
    ]);

    it('should correctly identify points inside the polygon', () => {
        expect(square.containsPoint(planck.Vec2(5, 5))).toBe(true);
        expect(square.containsPoint(planck.Vec2(1, 1))).toBe(true);
        expect(square.containsPoint(planck.Vec2(9, 9))).toBe(true);
    });

    it('should correctly identify points outside the polygon', () => {
        expect(square.containsPoint(planck.Vec2(-1, 5))).toBe(false);
        expect(square.containsPoint(planck.Vec2(11, 5))).toBe(false);
        expect(square.containsPoint(planck.Vec2(5, -1))).toBe(false);
        expect(square.containsPoint(planck.Vec2(5, 11))).toBe(false);
    });

    it('should correctly calculate distance to the polygon boundary', () => {
        // Points outside
        expect(square.distanceToPoint(planck.Vec2(-5, 5))).toBeCloseTo(5);
        expect(square.distanceToPoint(planck.Vec2(15, 5))).toBeCloseTo(5);
        expect(square.distanceToPoint(planck.Vec2(5, -5))).toBeCloseTo(5);
        expect(square.distanceToPoint(planck.Vec2(5, 15))).toBeCloseTo(5);

        // Corner cases
        expect(square.distanceToPoint(planck.Vec2(-3, -4))).toBeCloseTo(5); // 3-4-5 triangle

        // Points inside (distance to boundary is still positive)
        expect(square.distanceToPoint(planck.Vec2(1, 5))).toBeCloseTo(1);
        expect(square.distanceToPoint(planck.Vec2(5, 5))).toBeCloseTo(5);
    });

    it('should handle complex jagged polygons (similar to icebergs)', () => {
        const jagged = new Polygon([
            planck.Vec2(0, 0),
            planck.Vec2(5, 2),
            planck.Vec2(10, 0),
            planck.Vec2(8, 5),
            planck.Vec2(10, 10),
            planck.Vec2(5, 8),
            planck.Vec2(0, 10),
            planck.Vec2(2, 5)
        ]);

        expect(jagged.containsPoint(planck.Vec2(5, 5))).toBe(true);
        expect(jagged.containsPoint(planck.Vec2(0, 0))).toBe(false); // Ray casting typically excludes start points or handling varies
        expect(jagged.containsPoint(planck.Vec2(-1, -1))).toBe(false);
        expect(jagged.containsPoint(planck.Vec2(11, 11))).toBe(false);
        expect(jagged.distanceToPoint(planck.Vec2(5, 5))).toBeGreaterThan(0);
    });
});
