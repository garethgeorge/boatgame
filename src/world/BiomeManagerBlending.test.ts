
import { describe, it, expect, beforeEach } from 'vitest';
import { BiomeManager } from './BiomeManager';

describe('BiomeManager Blending', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager();
        // Force evaluation of a range to ensure biomes are created
        biomeManager.ensureZReached(-5000);
        biomeManager.ensureZReached(5000);
    });

    it('should return 100% weight for the center of a biome', () => {
        // Biome 0 is [-1500, 0] (Happy)
        // Center is -750
        const mixture = biomeManager.getBiomeMixture(-750);

        expect(mixture.weight1).toBe(1.0);
        expect(mixture.weight2).toBe(0.0);
        expect(mixture.features1).toBe(mixture.features2);
        expect(mixture.features1.id).toBe('happy');
    });

    it('should transition weights at boundaries', () => {
        // Boundary at Z = 0 (between Happy [-1500, 0] and whatever is next in +pos direction)
        // Transition width is 50, so +/- 25 around 0.

        // At exactly Z = 0 (max of first biome)
        const mixtureAt0 = biomeManager.getBiomeMixture(0);
        expect(mixtureAt0.weight1).toBe(0.5);
        expect(mixtureAt0.weight2).toBe(0.5);

        // At Z = -10 (inside first biome, near max)
        const mixtureAtNeg10 = biomeManager.getBiomeMixture(-10);
        // distFromMax = 10. t = (25 - 10) / 25 = 15/25 = 0.6
        // weight1 = lerp(1, 0.5, 0.6) = 1 * 0.4 + 0.5 * 0.6 = 0.4 + 0.3 = 0.7
        expect(mixtureAtNeg10.weight1).toBeCloseTo(0.7);
        expect(mixtureAtNeg10.weight2).toBeCloseTo(0.3);

        // At Z = 10 (inside second biome, near min)
        // Wait, currentZ = 0 is max of first, min of second.
        // If we sample 10, it's in the second biome.
        // distFromMin = 10. t = 10/25 = 0.4
        // weight1 = lerp(0.5, 1.0, 0.4) = 0.5 * 0.6 + 1 * 0.4 = 0.3 + 0.4 = 0.7
        const mixtureAt10 = biomeManager.getBiomeMixture(10);
        expect(mixtureAt10.weight1).toBeCloseTo(0.7);
        expect(mixtureAt10.weight2).toBeCloseTo(0.3);
    });

    it('should correctly blend fog density', () => {
        // Find a boundary where we know the types
        const z = 0;
        const mixture = biomeManager.getBiomeMixture(z);
        const d1 = mixture.features1.getFogDensity();
        const d2 = mixture.features2.getFogDensity();

        const blendedDensity = biomeManager.getBiomeFogDensity(z);
        expect(blendedDensity).toBe((d1 + d2) / 2);
    });

    it('should correctly blend ground color', () => {
        const z = 0;
        const mixture = biomeManager.getBiomeMixture(z);
        const c1 = mixture.features1.getGroundColor();
        const c2 = mixture.features2.getGroundColor();

        const blendedColor = biomeManager.getBiomeGroundColor(z);
        expect(blendedColor.r).toBe((c1.r + c2.r) / 2);
        expect(blendedColor.g).toBe((c1.g + c2.g) / 2);
        expect(blendedColor.b).toBe((c1.b + c2.b) / 2);
    });
});
