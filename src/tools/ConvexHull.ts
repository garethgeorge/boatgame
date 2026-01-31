import * as THREE from 'three';

export class ConvexHull {
    /**
     * Computes the 2D convex hull of a set of points using Monotone Chain.
     * Points are projected onto the X-Z plane.
     * Returns vertices in counter-clockwise order.
     */
    static compute(points: THREE.Vector3[]): THREE.Vector3[] {
        if (points.length <= 2) return [...points];

        // Sort points by x, then by z
        const sorted = [...points].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.z - b.z;
        });

        const upper: THREE.Vector3[] = [];
        for (const p of sorted) {
            while (upper.length >= 2 && this.crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        const lower: THREE.Vector3[] = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (lower.length >= 2 && this.crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        upper.pop();
        lower.pop();
        return upper.concat(lower);
    }

    private static crossProduct(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
        return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    }
}
