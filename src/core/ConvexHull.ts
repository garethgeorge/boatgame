import * as THREE from 'three';
import * as planck from 'planck';

export interface Point2D {
    x: number;
    y: number;
}

/**
 * Utility for computing convex hulls of 2D points.
 * Supports planck.Vec2 (x,y) and THREE.Vector3 (projected on x,z).
 */
export class ConvexHull {
    /**
     * Computes the 2D convex hull of a set of points using Monotone Chain algorithm.
     * Returns vertices in counter-clockwise order.
     */
    static computeVec2(points: planck.Vec2[]): planck.Vec2[] {
        if (points.length <= 2) return [...points];

        const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

        const lower: planck.Vec2[] = [];
        for (const p of sorted) {
            while (lower.length >= 2 && this.crossProductVec2(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper: planck.Vec2[] = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && this.crossProductVec2(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        lower.pop();
        upper.pop();
        return lower.concat(upper);
    }

    /**
     * Computes the 2D convex hull of a set of THREE.Vector3 points, projected onto the X-Z plane.
     * Returns vertices in counter-clockwise order.
     */
    static computeVector3(points: THREE.Vector3[]): THREE.Vector3[] {
        if (points.length <= 2) return [...points];

        const sorted = [...points].sort((a, b) => a.x === b.x ? a.z - b.z : a.x - b.x);

        const lower: THREE.Vector3[] = [];
        for (const p of sorted) {
            while (lower.length >= 2 && this.crossProductVector3(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper: THREE.Vector3[] = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && this.crossProductVector3(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        lower.pop();
        upper.pop();
        return lower.concat(upper);
    }

    private static crossProductVec2(a: planck.Vec2, b: planck.Vec2, c: planck.Vec2): number {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    private static crossProductVector3(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
        return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    }
}
