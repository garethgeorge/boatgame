import { RiverSystem } from "./RiverSystem";

export interface RiverGeometrySample {
    centerPos: { x: number, z: number };
    tangent: { x: number, z: number };
    normal: { x: number, z: number }; // Points to the right bank
    bankDist: number;       // Distance to either bank along the normal vector
    arcLength: number;      // Cumulative arc length from some start point
}

export class RiverGeometry {

    public static getRiverGeometrySample(river: RiverSystem, z: number, arcLength: number = 0): RiverGeometrySample {
        const x = river.getRiverCenter(z);
        const dx_dz = river.getRiverDerivative(z);

        // Tangent vector T = (dx/dz, 1) normalized
        const length = Math.sqrt(dx_dz * dx_dz + 1);
        const tangent = { x: dx_dz / length, z: 1 / length };

        // Normal vector N = (1, -dx/dz) normalized (pointing right-ish)
        const normal = { x: 1 / length, z: -dx_dz / length };

        // Iterative solver to find distance along normal to banks
        // Banks are at x_bank = getRiverCenter(z_bank) +/- getRiverWidth(z_bank)/2
        // returns distance d such that center + d * normal is on the target side
        const findBankDistance = (side: 1 | -1): number => {
            let d = side * river.getRiverWidth(z) / 2; // Initial guess
            const maxAttempts = 5;
            for (let i = 0; i < maxAttempts; i++) {
                const pz = z + d * normal.z;
                const px = x + d * normal.x;
                const center = river.getRiverCenter(pz);
                const halfWidth = river.getRiverWidth(pz) / 2;
                const targetX = center + side * halfWidth;

                // This is a simple iterative refinement.
                // We want px to match targetX.
                // The error is (px - targetX). We adjust d.
                const error = px - targetX;
                d -= error * normal.x;
            }
            return Math.abs(d);
        };

        const leftDist = findBankDistance(-1); // Side -1 is left
        const rightDist = findBankDistance(1);  // Side 1 is right

        // Adjust center so it is equidistant from both banks along the normal
        const centerAdjustment = (rightDist - leftDist) / 2;
        const adjustedX = x + centerAdjustment * normal.x;
        const adjustedZ = z + centerAdjustment * normal.z;
        const bankDist = (leftDist + rightDist) / 2;

        return {
            centerPos: { x: adjustedX, z: adjustedZ },
            tangent,
            normal,
            bankDist,
            arcLength
        };
    }

    /**
     * Samples the river at regular arc length intervals.
     * Supports sampling in either Z direction.
     */
    public static sampleRiver(river: RiverSystem, zStart: number, zEnd: number, stepArcLength: number): RiverGeometrySample[] {
        const samples: RiverGeometrySample[] = [];
        const direction = zEnd > zStart ? 1 : -1;
        let currentZ = zStart;
        let accumulatedArcLength = 0;
        let nextSampleArcLengthTarget = 0;

        // Initial point
        samples.push(this.getRiverGeometrySample(river, currentZ, accumulatedArcLength));
        nextSampleArcLengthTarget += stepArcLength;

        const integrationStep = 1.0;

        while (direction > 0 ? currentZ < zEnd : currentZ > zEnd) {
            // Numerical integration of ds = sqrt(1 + (dx/dz)^2) |dz|
            const dx_dz = river.getRiverDerivative(currentZ);
            const ds = Math.sqrt(1 + dx_dz * dx_dz) * integrationStep;

            currentZ += integrationStep * direction;
            accumulatedArcLength += ds;

            if (accumulatedArcLength >= nextSampleArcLengthTarget) {
                samples.push(this.getRiverGeometrySample(river, currentZ, accumulatedArcLength));
                nextSampleArcLengthTarget += stepArcLength;
            }
        }

        return samples;
    }

    /**
     * Get path point given a fractional index
     */
    public static getPathPoint<T extends RiverGeometrySample>(points: T[], index: number): T {
        if (points.length === 0) throw new Error('Path is empty');

        const i = Math.floor(index);
        if (i + 1 >= points.length)
            return points[points.length - 1];
        const t = index - i;
        const p1 = points[i];
        const p2 = points[i + 1];
        return this.interpolatePathPoint(p1, p2, t);
    }

    /**
     * Get an interpolated location between two points
     */
    public static interpolatePathPoint<T extends RiverGeometrySample>(p1: T, p2: T, t: number): T {
        const result: any = {
            centerPos: {
                x: p1.centerPos.x + t * (p2.centerPos.x - p1.centerPos.x),
                z: p1.centerPos.z + t * (p2.centerPos.z - p1.centerPos.z)
            },
            tangent: {
                x: p1.tangent.x + t * (p2.tangent.x - p1.tangent.x),
                z: p1.tangent.z + t * (p2.tangent.z - p1.tangent.z)
            },
            normal: {
                x: p1.normal.x + t * (p2.normal.x - p1.normal.x),
                z: p1.normal.z + t * (p2.normal.z - p1.normal.z)
            },
            bankDist: p1.bankDist + t * (p2.bankDist - p1.bankDist),
            arcLength: p1.arcLength + t * (p2.arcLength - p1.arcLength)
        };

        // Copy extra properties if they exist
        for (const key in p1) {
            if (!(key in result)) {
                const v1 = (p1 as any)[key];
                const v2 = (p2 as any)[key];
                if (typeof v1 === 'number' && typeof v2 === 'number') {
                    result[key] = v1 + t * (v2 - v1);
                } else {
                    result[key] = v1;
                }
            }
        }

        return result as T;
    }

    /**
     * Given an arc length find corresponding fractional index in the the path
     * point array.
     */
    public static getPathIndexByArcLen<T extends RiverGeometrySample>(points: T[], arcLen: number): number {
        return this.binarySearchPath(points, arcLen, (point: T) => {
            return point.arcLength;
        })
    }

    /**
     * Given a worldZ find corresponding fractional index in the the path
     * point array. The path points may be in order of increasing or
     * decreasing z.
     */
    public static getPathIndexByZ<T extends RiverGeometrySample>(points: T[], worldZ: number): number {
        return this.binarySearchPath(points, worldZ, (point: T) => {
            return point.centerPos.z;
        });
    }

    /**
     * Search for fractional index corresponding to a given value. The
     * values in the path must either be ascending or descending.
     */
    public static binarySearchPath<T>(points: T[], value: number,
        pointValue: (point: T) => number): number {
        if (points.length === 0) return 0;
        if (points.length === 1) return 0;

        const isAscending = pointValue(points[points.length - 1]) > pointValue(points[0]);

        let low = 0;
        let high = points.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midValue = pointValue(points[mid]);
            if (midValue === value) return mid;

            if (isAscending) {
                if (midValue < value) low = mid + 1;
                else high = mid - 1;
            } else {
                if (midValue > value) low = mid + 1;
                else high = mid - 1;
            }
        }

        if (high < 0) return 0;
        if (low >= points.length) return points.length - 1;

        const p1 = points[high];
        const p2 = points[low];
        const delta = pointValue(p2) - pointValue(p1);
        const t = delta === 0 ? 0 : (value - pointValue(p1)) / delta;

        return high + t;
    }
}
