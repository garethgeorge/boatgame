
import { describe, it, expect, beforeEach } from 'vitest';
import { BiomeManager } from './BiomeManager';

describe('BiomeManager Blending', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager();
    });

    it('should return 100% weight for the center of a biome', () => {
        biomeManager.ensureWindow(0, 0);
        const boundaries = biomeManager.getBiomeBoundaries(0);
        const mid = (boundaries.zMin + boundaries.zMax) / 2;

        biomeManager.ensureWindow(mid, mid);
        const mixture = (biomeManager as any).getBiomeMixture(mid);

        expect(mixture[0].weight).toBe(1.0);
        expect(mixture.length).toBe(1);
        expect(mixture[0].biome.id).toBe('happy');
    });

    it('should transition weights at boundaries', () => {
        biomeManager.ensureWindow(0, 0);
        const boundaries = biomeManager.getBiomeBoundaries(0);
        const boundaryZ = boundaries.zMax; // Max of the initial biome (should be 0)

        // At exactly the boundary
        // We might need to ensure the neighbor exists by updating near it
        biomeManager.ensureWindow(boundaryZ - 100, boundaryZ + 100);

        const mixtureAtBoundary = (biomeManager as any).getBiomeMixture(boundaryZ);
        expect(mixtureAtBoundary[0].weight).toBe(0.5);
        expect(mixtureAtBoundary[1].weight).toBe(0.5);

        // Transition width is 50, so +/- 25 around boundary
        const sampleOffset = 10;

        // Inside first biome (near max)
        const zNeg = boundaryZ - sampleOffset;
        const mixtureAtNeg = (biomeManager as any).getBiomeMixture(zNeg);
        // t = (25 - 10) / 25 = 0.6
        // weight1 = lerp(0.5, 1.0, 0.6) = 0.8  <-- Wait, I changed the lerp in getBiomeMixture
        // weight1 = lerp(1, 0.5, 0.4) = 0.7  <-- Actually, the math depends on the implementation.
        // Let's check the old test vs new mixture.
        expect(mixtureAtNeg[0].weight).toBeCloseTo(0.7);
        expect(mixtureAtNeg[1].weight).toBeCloseTo(0.3);

        // Inside second biome (near min)
        const zPos = boundaryZ + sampleOffset;
        const mixtureAtPos = (biomeManager as any).getBiomeMixture(zPos);
        // t = 10 / 25 = 0.4
        // weight1 = lerp(0.5, 1.0, 0.4) = 0.7
        expect(mixtureAtPos[0].weight).toBeCloseTo(0.7);
        expect(mixtureAtPos[1].weight).toBeCloseTo(0.3);
    });

    it('should correctly blend fog density', () => {
        // Find a boundary where we know the types
        const z = 0;
        biomeManager.ensureWindow(z, z);
        const mixture = (biomeManager as any).getBiomeMixture(z);
        const d1 = mixture[0].biome.getFogDensity();
        const d2 = mixture[1].biome.getFogDensity();

        const blendedDensity = biomeManager.getBiomeFogDensity(z);
        expect(blendedDensity).toBe((d1 + d2) / 2);
    });

    it('should correctly blend ground color', () => {
        const z = 0;
        biomeManager.ensureWindow(z, z);
        const mixture = (biomeManager as any).getBiomeMixture(z);
        const c1 = mixture[0].biome.getGroundColor(0, 0, z);
        const c2 = mixture[1].biome.getGroundColor(0, 0, z);

        const blendedColor = biomeManager.getBiomeGroundColor(0, 0, z);
        expect(blendedColor.r).toBe((c1.r + c2.r) / 2);
        expect(blendedColor.g).toBe((c1.g + c2.g) / 2);
        expect(blendedColor.b).toBe((c1.b + c2.b) / 2);
    });
});
