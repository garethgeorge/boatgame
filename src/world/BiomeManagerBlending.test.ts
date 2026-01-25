
import { describe, it, expect, beforeEach } from 'vitest';
import { BiomeManager } from './BiomeManager';

describe('BiomeManager Blending', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager();
    });

    it('should return 100% weight for the center of a biome', () => {
        const boundaries = biomeManager.getBiomeBoundaries(0);
        const mid = (boundaries.zMin + boundaries.zMax) / 2;

        biomeManager.update(mid);
        const mixture = (biomeManager as any).getBiomeMixture(mid);

        expect(mixture.weight1).toBe(1.0);
        expect(mixture.weight2).toBe(0.0);
        expect(mixture.features1).toBe(mixture.features2);
        expect(mixture.features1.id).toBe('happy');
    });

    it('should transition weights at boundaries', () => {
        const boundaries = biomeManager.getBiomeBoundaries(0);
        const boundaryZ = boundaries.zMax; // Max of the initial biome (should be 0)

        // At exactly the boundary
        // We might need to ensure the neighbor exists by updating near it
        biomeManager.update(boundaryZ + 100);

        const mixtureAtBoundary = (biomeManager as any).getBiomeMixture(boundaryZ);
        expect(mixtureAtBoundary.weight1).toBe(0.5);
        expect(mixtureAtBoundary.weight2).toBe(0.5);

        // Transition width is 50, so +/- 25 around boundary
        const sampleOffset = 10;

        // Inside first biome (near max)
        const zNeg = boundaryZ - sampleOffset;
        const mixtureAtNeg = (biomeManager as any).getBiomeMixture(zNeg);
        // t = (25 - 10) / 25 = 0.6
        // weight1 = lerp(1, 0.5, 0.6) = 0.7
        expect(mixtureAtNeg.weight1).toBeCloseTo(0.7);
        expect(mixtureAtNeg.weight2).toBeCloseTo(0.3);

        // Inside second biome (near min)
        const zPos = boundaryZ + sampleOffset;
        const mixtureAtPos = (biomeManager as any).getBiomeMixture(zPos);
        // t = 10 / 25 = 0.4
        // weight1 = lerp(0.5, 1.0, 0.4) = 0.7
        expect(mixtureAtPos.weight1).toBeCloseTo(0.7);
        expect(mixtureAtPos.weight2).toBeCloseTo(0.3);
    });

    it('should correctly blend fog density', () => {
        // Find a boundary where we know the types
        const z = 0;
        biomeManager.update(z);
        const mixture = (biomeManager as any).getBiomeMixture(z);
        const d1 = mixture.features1.getFogDensity();
        const d2 = mixture.features2.getFogDensity();

        const blendedDensity = biomeManager.getBiomeFogDensity(z);
        expect(blendedDensity).toBe((d1 + d2) / 2);
    });

    it('should correctly blend ground color', () => {
        const z = 0;
        biomeManager.update(z);
        const mixture = (biomeManager as any).getBiomeMixture(z);
        const c1 = mixture.features1.getGroundColor();
        const c2 = mixture.features2.getGroundColor();

        const blendedColor = biomeManager.getBiomeGroundColor(z);
        expect(blendedColor.r).toBe((c1.r + c2.r) / 2);
        expect(blendedColor.g).toBe((c1.g + c2.g) / 2);
        expect(blendedColor.b).toBe((c1.b + c2.b) / 2);
    });
});
