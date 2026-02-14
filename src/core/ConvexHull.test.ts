import { describe, it, expect } from 'vitest';
import * as planck from 'planck';
import * as THREE from 'three';
import { ConvexHull } from './ConvexHull';

describe('ConvexHull', () => {
    describe('computeVec2', () => {
        it('should handle less than 3 points', () => {
            const points = [planck.Vec2(0, 0), planck.Vec2(1, 1)];
            const hull = ConvexHull.computeVec2(points);
            expect(hull).toHaveLength(2);
            expect(hull[0].x).toBe(0);
            expect(hull[1].x).toBe(1);
        });

        it('should compute a basic box hull', () => {
            const points = [
                planck.Vec2(0, 0),
                planck.Vec2(1, 0),
                planck.Vec2(1, 1),
                planck.Vec2(0, 1),
                planck.Vec2(0.5, 0.5) // Internal point
            ];
            const hull = ConvexHull.computeVec2(points);
            expect(hull).toHaveLength(4);
            // Monotone chain returns sorted order starting from leftmost
            // We expect the 4 corners, CCW or CW depending on implementation
            // our implementation returns lower + upper
            // lower: (0,0), (1,0)
            // upper: (1,1), (0,1)
            // concatenated: (0,0), (1,0), (1,1), (0,1) - CCW
            expect(hull[0]).toEqual(planck.Vec2(0, 0));
            expect(hull[1]).toEqual(planck.Vec2(1, 0));
            expect(hull[2]).toEqual(planck.Vec2(1, 1));
            expect(hull[3]).toEqual(planck.Vec2(0, 1));
        });

        it('should handle collinear points', () => {
            const points = [
                planck.Vec2(0, 0),
                planck.Vec2(1, 0),
                planck.Vec2(2, 0),
                planck.Vec2(1, 1)
            ];
            const hull = ConvexHull.computeVec2(points);
            // Monotone chain with <= 0 cross product removes collinear points
            expect(hull).toHaveLength(3);
            expect(hull).toContainEqual(planck.Vec2(0, 0));
            expect(hull).toContainEqual(planck.Vec2(2, 0));
            expect(hull).toContainEqual(planck.Vec2(1, 1));
        });
    });

    describe('computeVector3', () => {
        it('should compute hull on X-Z plane', () => {
            const points = [
                new THREE.Vector3(0, 10, 0),
                new THREE.Vector3(1, 20, 0),
                new THREE.Vector3(1, 30, 1),
                new THREE.Vector3(0, 40, 1),
                new THREE.Vector3(0.5, 50, 0.5)
            ];
            const hull = ConvexHull.computeVector3(points);
            expect(hull).toHaveLength(4);
            expect(hull[0].x).toBe(0); expect(hull[0].z).toBe(0);
            expect(hull[1].x).toBe(1); expect(hull[1].z).toBe(0);
            expect(hull[2].x).toBe(1); expect(hull[2].z).toBe(1);
            expect(hull[3].x).toBe(0); expect(hull[3].z).toBe(1);
        });
    });
});
