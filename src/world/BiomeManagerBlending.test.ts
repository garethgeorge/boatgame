
import { describe, it, expect, beforeEach } from 'vitest';
import { BiomeManager } from './BiomeManager';
import { ProceduralBiomeGenerator } from './ProceduralBiomeGenerator';

// Helper to call the private getBiomeMixture and read results from the static scratch array.
function callGetBiomeMixture(bm: BiomeManager, worldZ: number) {
    const count = (bm as any).getBiomeMixture(worldZ) as number;
    const scratch = (BiomeManager as any)._mixtureScratch;
    // Return a snapshot so tests can call getBiomeMixture again without clobbering.
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push({ biome: scratch[i].biome, weight: scratch[i].weight });
    }
    return result;
}

describe('BiomeManager Blending', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager(new ProceduralBiomeGenerator(), new ProceduralBiomeGenerator());
    });

    it('should return 100% weight for the center of a biome', () => {
        biomeManager.ensureWindow(0, 0);
        const boundaries = biomeManager.getBiomeBoundaries(0);
        const mid = (boundaries.zMin + boundaries.zMax) / 2;

        biomeManager.ensureWindow(mid, mid);
        const mixture = callGetBiomeMixture(biomeManager, mid);

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

        const mixtureAtBoundary = callGetBiomeMixture(biomeManager, boundaryZ);
        expect(mixtureAtBoundary[0].weight).toBe(0.5);
        expect(mixtureAtBoundary[1].weight).toBe(0.5);

        // Transition width is 50, so +/- 25 around boundary
        const sampleOffset = 10;

        // Inside first biome (near max)
        const zNeg = boundaryZ - sampleOffset;
        const mixtureAtNeg = callGetBiomeMixture(biomeManager, zNeg);
        expect(mixtureAtNeg[0].weight).toBeCloseTo(0.7);
        expect(mixtureAtNeg[1].weight).toBeCloseTo(0.3);

        // Inside second biome (near min)
        const zPos = boundaryZ + sampleOffset;
        const mixtureAtPos = callGetBiomeMixture(biomeManager, zPos);
        expect(mixtureAtPos[0].weight).toBeCloseTo(0.7);
        expect(mixtureAtPos[1].weight).toBeCloseTo(0.3);
    });

    it('should correctly blend fog density', () => {
        // Find a boundary where we know the types
        const z = 0;
        biomeManager.ensureWindow(z, z);
        const mixture = callGetBiomeMixture(biomeManager, z);
        const d1 = mixture[0].biome.getFogDensity();
        const d2 = mixture[1].biome.getFogDensity();

        const blendedDensity = biomeManager.getBiomeFogDensity(z);
        expect(blendedDensity).toBe((d1 + d2) / 2);
    });

    it('should correctly blend ground color', () => {
        const z = 0;
        biomeManager.ensureWindow(z, z);
        const mixture = callGetBiomeMixture(biomeManager, z);
        const c1 = mixture[0].biome.getGroundColor(0, 0, z, 0);
        const c2 = mixture[1].biome.getGroundColor(0, 0, z, 0);

        const blendedColor = biomeManager.getBiomeGroundColor(0, 0, z, 0);
        expect(blendedColor.r).toBe((c1.r + c2.r) / 2);
        expect(blendedColor.g).toBe((c1.g + c2.g) / 2);
        expect(blendedColor.b).toBe((c1.b + c2.b) / 2);
    });
});
