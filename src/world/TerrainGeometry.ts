import * as THREE from 'three';
import { SimplexNoise } from '../core/SimplexNoise';
import { RiverSystem } from './RiverSystem';
import { MathUtils } from '../core/MathUtils';

export class TerrainGeometry {
    private noise: SimplexNoise;
    private riverSystem: RiverSystem;

    constructor(riverSystem: RiverSystem) {
        this.noise = new SimplexNoise(200);
        this.riverSystem = riverSystem;
    }


    public isPointInRiver(wx: number, wz: number): boolean {
        const riverCenter = this.riverSystem.getRiverCenter(wz);
        const riverWidth = this.riverSystem.getRiverWidth(wz);
        const riverEdge = riverWidth / 2;
        const distFromCenter = Math.abs(wx - riverCenter);
        return distFromCenter < riverEdge;
    }

    // Returns height of terrain at world space position (wx, wz) and
    // given the distance from the closest river bank (distFromBank)
    // land height tapers to 0 at river edge and is 0 across the river
    private calculateRawLandHeight(wx: number, wz: number, distFromBank: number): number {
        // 1. Land Generation (Base Terrain)
        // Note that land coordinates are in world space
        // "Mountainous" Map: Low frequency noise to determine biome
        let mountainMask = this.noise.noise2D(wx * 0.001, wz * 0.001);
        mountainMask = (mountainMask + 1) / 2; // Normalize to 0-1
        mountainMask = Math.pow(mountainMask, 2); // Bias towards 0 (more hills than mountains)

        // Rolling Hills (Low Amplitude, Smooth)
        const hillNoise =
            this.noise.noise2D(wx * 0.01, wz * 0.01) * 5 +
            this.noise.noise2D(wx * 0.03, wz * 0.03) * 2;

        // Rugged Mountains (High Amplitude, Ridged)
        const ridge1 = 1 - Math.abs(this.noise.noise2D(wx * 0.005, wz * 0.005));
        const ridge2 = 1 - Math.abs(this.noise.noise2D(wx * 0.01, wz * 0.01));
        const mountainNoise = (Math.pow(ridge1, 2) * 40 + Math.pow(ridge2, 2) * 10);

        // Blend based on mask
        let rawLandHeight = (hillNoise * (1 - mountainMask)) + (mountainNoise * mountainMask);

        // Add detail noise everywhere
        rawLandHeight += this.noise.noise2D(wx * 0.1, wz * 0.1) * 1.0;

        // FIX: Clamp land height to be strictly above water level to prevent inland lakes
        // We add a base height (e.g. 2.0) and clamp
        rawLandHeight = Math.max(2.0, rawLandHeight + 2.0);

        const amplitudeMultiplier = this.riverSystem.biomeManager.getAmplitudeMultiplier(wx, wz, distFromBank);
        rawLandHeight *= amplitudeMultiplier;

        return rawLandHeight;
    }

    // Returns height of river bed given the distance from the center of the
    // river and the total distance from center to edge
    private calculateRawRiverHeight(distFromCenter: number, riverEdge: number): number {

        const depth = 8; // Deeper river
        // Parabolic profile: 1 at center, 0 at edge
        const normalizedX = Math.min(1.0, distFromCenter / riverEdge);
        const riverBedHeight = -depth * (1 - normalizedX * normalizedX);

        return riverBedHeight;
    }

    // Convert world space to
    // distance from center of river
    // total distance from center to edge at that position
    // dx, dy is the direction vector from center to edge
    private calculateRiverRelativePosition(wx: number, wz: number): {
        distFromCenter: number,
        riverEdge: number,
        dx: number,
        dy: number
    } {
        const riverCenter = this.riverSystem.getRiverCenter(wz);
        const riverWidth = this.riverSystem.getRiverWidth(wz);
        const riverEdge = riverWidth / 2;

        const distFromCenter = Math.abs(wx - riverCenter);
        const dx = Math.sign(wx - riverCenter);
        const dy = 0.0;

        return { distFromCenter, riverEdge, dx, dy };
    }

    // Returns height of terrain at world space position (wx, wz)
    public calculateHeight(wx: number, wz: number): number {

        const { distFromCenter, riverEdge } = this.calculateRiverRelativePosition(wx, wz);

        // 1. Calculate Raw Heights
        const rawLandHeight = this.calculateRawLandHeight(wx, wz, distFromCenter - riverEdge);
        const rawRiverHeight = this.calculateRawRiverHeight(distFromCenter, riverEdge);

        // 2. Blend Land and River
        // We blend over a small zone around the edge to avoid hard creases
        const transitionWidth = 8.0; // Slightly wider transition for smoother visuals
        const mixFactor = MathUtils.smoothstep(riverEdge - transitionWidth / 2, riverEdge + transitionWidth / 2, distFromCenter);

        // mixFactor is 0 inside river (bed), 1 outside (land)
        return (1 - mixFactor) * rawRiverHeight + mixFactor * rawLandHeight;
    }

    // Returns normal of terrain at world space position (wx, wz)
    public calculateNormal(wx: number, wz: number): THREE.Vector3 {
        // for reference...
        // z points into the distance
        // x points to the right
        // y points up
        const { distFromCenter, riverEdge, dx, dy } = this.calculateRiverRelativePosition(wx, wz);
        const distFromBank = distFromCenter - riverEdge;

        // (a) If in river, return upright normal
        if (distFromBank < 0) {
            return new THREE.Vector3(0, 1, 0);
        }

        // (b) If on land, ignore river for height values (use rawLandHeight)
        const epsilon = 0.1;

        const hL = this.calculateRawLandHeight(wx - epsilon, wz, distFromBank - dx * epsilon);
        const hR = this.calculateRawLandHeight(wx + epsilon, wz, distFromBank + dx * epsilon);
        const hD = this.calculateRawLandHeight(wx, wz - epsilon, distFromBank - dy * epsilon);
        const hU = this.calculateRawLandHeight(wx, wz + epsilon, distFromBank + dy * epsilon);

        // Normal vector: cross product of tangent vectors
        const v1 = new THREE.Vector3(2 * epsilon, hR - hL, 0);
        const v2 = new THREE.Vector3(0, hU - hD, 2 * epsilon);

        const normal = new THREE.Vector3().crossVectors(v2, v1).normalize();
        return normal;
    }

    public checkVisibility(
        targetWorldX: number, targetHeight: number, worldZ: number,
        steps: number = 4): boolean {
        // Ray start: River center (world coordinates), slightly above water (y = 2)
        const riverCenter = this.riverSystem.getRiverCenter(worldZ);
        const startX = riverCenter;
        const startY = 2;

        const endX = targetWorldX;
        const endY = targetHeight;

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const checkX = startX + (endX - startX) * t;
            const checkY = startY + (endY - startY) * t;

            // Sample terrain height at this point
            const terrainHeight = this.calculateHeight(checkX, worldZ);

            // If terrain is significantly higher than ray point, it's occluded
            if (terrainHeight > checkY + 0.5) { // 0.5 buffer
                return false;
            }
        }

        return true;
    }
}
