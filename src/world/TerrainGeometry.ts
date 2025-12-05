import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';
import { RiverSystem } from './RiverSystem';

export class TerrainGeometry {
    private noise: SimplexNoise;
    private riverSystem: RiverSystem;

    constructor(riverSystem: RiverSystem) {
        this.noise = new SimplexNoise(200);
        this.riverSystem = riverSystem;
    }

    // Returns height of terrain at world space position (wx, wz)
    public calculateHeight(wx: number, wz: number): number {

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

        // Apply Bank Taper: Force land height to 0 at the river edge
        // Smoothly ramp up over 15 units
        const riverCenter = this.riverSystem.getRiverCenter(wz);
        const riverWidth = this.riverSystem.getRiverWidth(wz);

        const riverEdge = riverWidth / 2;
        const distFromCenter = Math.abs(wx - riverCenter);
        const distFromBank = distFromCenter - riverEdge;

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

    // Returns normal of terrain at world space position (wx, wz)
    public calculateNormal(wx: number, wz: number): THREE.Vector3 {
        const epsilon = 0.1;

        const hL = this.calculateHeight(wx - epsilon, wz);
        const hR = this.calculateHeight(wx + epsilon, wz);
        const hD = this.calculateHeight(wx, wz - epsilon);
        const hU = this.calculateHeight(wx, wz + epsilon);

        // Normal vector: cross product of tangent vectors
        const v1 = new THREE.Vector3(2 * epsilon, hR - hL, 0);
        const v2 = new THREE.Vector3(0, hU - hD, 2 * epsilon);

        const normal = new THREE.Vector3().crossVectors(v2, v1).normalize();
        return normal;
    }

    public checkVisibility(targetWorldX: number, targetHeight: number, worldZ: number): boolean {
        // Ray start: River center (world coordinates), slightly above water (y = 2)
        const riverCenter = this.riverSystem.getRiverCenter(worldZ);
        const startX = riverCenter;
        const startY = 2;

        const endX = targetWorldX;
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
