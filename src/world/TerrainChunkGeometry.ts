import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';
import { RiverSystem } from './RiverSystem';

export class TerrainChunkGeometry {
    private noise: SimplexNoise;
    private riverSystem: RiverSystem;

    constructor() {
        this.noise = new SimplexNoise(200);
        this.riverSystem = RiverSystem.getInstance();
    }

    public calculateHeight(x: number, z: number): number {
        // x is distance from river center (localX)

        const riverWidth = this.riverSystem.getRiverWidth(z);
        const riverEdge = riverWidth / 2;
        const distFromCenter = Math.abs(x);
        const distFromBank = distFromCenter - riverEdge;

        // 1. Land Generation (Base Terrain)
        // "Mountainous" Map: Low frequency noise to determine biome
        let mountainMask = this.noise.noise2D(x * 0.001, z * 0.001);
        mountainMask = (mountainMask + 1) / 2; // Normalize to 0-1
        mountainMask = Math.pow(mountainMask, 2); // Bias towards 0 (more hills than mountains)

        // Rolling Hills (Low Amplitude, Smooth)
        const hillNoise =
            this.noise.noise2D(x * 0.01, z * 0.01) * 5 +
            this.noise.noise2D(x * 0.03, z * 0.03) * 2;

        // Rugged Mountains (High Amplitude, Ridged)
        const ridge1 = 1 - Math.abs(this.noise.noise2D(x * 0.005, z * 0.005));
        const ridge2 = 1 - Math.abs(this.noise.noise2D(x * 0.01, z * 0.01));
        const mountainNoise = (Math.pow(ridge1, 2) * 40 + Math.pow(ridge2, 2) * 10);

        // Blend based on mask
        let rawLandHeight = (hillNoise * (1 - mountainMask)) + (mountainNoise * mountainMask);

        // Add detail noise everywhere
        rawLandHeight += this.noise.noise2D(x * 0.1, z * 0.1) * 1.0;

        // FIX: Clamp land height to be strictly above water level to prevent inland lakes
        // We add a base height (e.g. 2.0) and clamp
        rawLandHeight = Math.max(2.0, rawLandHeight + 2.0);

        // Apply Bank Taper: Force land height to 0 at the river edge
        // Smoothly ramp up over 15 units
        const bankTaper = this.smoothstep(0, 15, distFromBank);
        const landHeight = rawLandHeight * bankTaper;

        // 2. River Bed Generation
        const depth = 8; // Deeper river
        // Parabolic profile: 1 at center, 0 at edge
        const normalizedX = Math.min(1.0, distFromCenter / riverEdge);
        const riverBedHeight = -depth * (1 - normalizedX * normalizedX);

        // 3. Blend Land and River
        // We blend over a small zone around the edge to avoid hard creases
        const transitionWidth = 8.0; // Slightly wider transition for smoother visuals
        const mixFactor = this.smoothstep(riverEdge - transitionWidth / 2, riverEdge + transitionWidth / 2, distFromCenter);

        // mixFactor is 0 inside river (bed), 1 outside (land)
        return (1 - mixFactor) * riverBedHeight + mixFactor * landHeight;
    }

    public calculateNormal(x: number, z: number): THREE.Vector3 {
        const epsilon = 0.1;

        const hL = this.calculateHeight(x - epsilon, z);
        const hR = this.calculateHeight(x + epsilon, z);
        const hD = this.calculateHeight(x, z - epsilon);
        const hU = this.calculateHeight(x, z + epsilon);

        // Normal vector: cross product of tangent vectors
        const v1 = new THREE.Vector3(2 * epsilon, hR - hL, 0);
        const v2 = new THREE.Vector3(0, hU - hD, 2 * epsilon);

        const normal = new THREE.Vector3().crossVectors(v2, v1).normalize();
        return normal;
    }

    public checkVisibility(targetLocalX: number, targetHeight: number, worldZ: number): boolean {
        // Ray start: River center (localX = 0), slightly above water (y = 2)
        const startX = 0;
        const startY = 2;

        const endX = targetLocalX;
        const endY = targetHeight;

        const steps = 4; // Number of checks along the ray

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

    private smoothstep(edge0: number, edge1: number, x: number): number {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }
}
