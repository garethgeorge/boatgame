import * as THREE from 'three';

export class DecimateHull {
    /**
     * Decimates a convex hull down to exactly n vertices using Visvalingam-Whyatt style area reduction.
     * Assumes hull is counter-clockwise.
     */
    static decimate(hull: THREE.Vector3[], targetCount: number): THREE.Vector3[] {
        if (hull.length <= targetCount) return [...hull];

        const points = [...hull];

        while (points.length > targetCount) {
            let minArea = Infinity;
            let removeIndex = -1;

            for (let i = 0; i < points.length; i++) {
                const prev = points[(i - 1 + points.length) % points.length];
                const curr = points[i];
                const next = points[(i + 1) % points.length];

                const area = this.calculateArea(prev, curr, next);
                if (area < minArea) {
                    minArea = area;
                    removeIndex = i;
                }
            }

            if (removeIndex !== -1) {
                points.splice(removeIndex, 1);
            } else {
                break;
            }
        }

        return points;
    }

    private static calculateArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
        // Area = 0.5 * |x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2)|
        // Map y to z
        return 0.5 * Math.abs(
            a.x * (b.z - c.z) +
            b.x * (c.z - a.z) +
            c.x * (a.z - b.z)
        );
    }
}
