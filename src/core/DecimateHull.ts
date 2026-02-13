import * as THREE from 'three';
import * as planck from 'planck';

/**
 * Utility for decimating convex hulls down to a target number of vertices.
 * Uses Visvalingam-Whyatt style area reduction.
 */
export class DecimateHull {
    /**
     * Decimates a convex hull of planck.Vec2 points down to targetCount.
     */
    static decimateVec2(hull: planck.Vec2[], targetCount: number): planck.Vec2[] {
        if (hull.length <= targetCount) return [...hull];

        const points = [...hull];
        while (points.length > targetCount) {
            let minArea = Infinity;
            let removeIndex = -1;

            for (let i = 0; i < points.length; i++) {
                const prev = points[(i - 1 + points.length) % points.length];
                const curr = points[i];
                const next = points[(i + 1) % points.length];

                const area = this.calculateAreaVec2(prev, curr, next);
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

    /**
     * Decimates a convex hull of THREE.Vector3 points (X-Z plane) down to targetCount.
     */
    static decimateVector3(hull: THREE.Vector3[], targetCount: number): THREE.Vector3[] {
        if (hull.length <= targetCount) return [...hull];

        const points = [...hull];
        while (points.length > targetCount) {
            let minArea = Infinity;
            let removeIndex = -1;

            for (let i = 0; i < points.length; i++) {
                const prev = points[(i - 1 + points.length) % points.length];
                const curr = points[i];
                const next = points[(i + 1) % points.length];

                const area = this.calculateAreaVector3(prev, curr, next);
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

    private static calculateAreaVec2(a: planck.Vec2, b: planck.Vec2, c: planck.Vec2): number {
        return 0.5 * Math.abs(
            a.x * (b.y - c.y) +
            b.x * (c.y - a.y) +
            c.x * (a.y - b.y)
        );
    }

    private static calculateAreaVector3(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
        return 0.5 * Math.abs(
            a.x * (b.z - c.z) +
            b.x * (c.z - a.z) +
            c.x * (a.z - b.z)
        );
    }
}
