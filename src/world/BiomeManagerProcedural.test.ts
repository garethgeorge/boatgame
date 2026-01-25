import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BiomeManager } from './BiomeManager';

describe('BiomeManager Procedural Generation', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager();
    });

    it('should generate an initial biome at Z=0', () => {
        const boundaries = biomeManager.getBiomeBoundaries(0);
        // Biome 0 is [-1500, 0]
        expect(boundaries.zMin).toBe(-1500);
        expect(boundaries.zMax).toBe(0);
        expect(biomeManager.getBiomeType(0)).toBe('happy');
    });

    it('should grow forward (-ve Z) on demand', () => {
        const startBiome = biomeManager.getBiomeType(0);
        // Move deep into negative Z
        const targetZ = -5000;
        biomeManager.ensureZReached(targetZ);

        const biomeAtTarget = biomeManager.getBiomeType(targetZ);
        expect(biomeAtTarget).toBeDefined();

        const boundaries = biomeManager.getBiomeBoundaries(targetZ);
        expect(targetZ).toBeGreaterThan(Math.min(boundaries.zMin, boundaries.zMax));
        expect(targetZ).toBeLessThanOrEqual(Math.max(boundaries.zMin, boundaries.zMax));
    });

    it('should grow backward (+ve Z) on demand', () => {
        const targetZ = 5000;
        biomeManager.ensureZReached(targetZ);

        const biomeAtTarget = biomeManager.getBiomeType(targetZ);
        expect(biomeAtTarget).toBeDefined();

        const boundaries = biomeManager.getBiomeBoundaries(targetZ);
        expect(targetZ).toBeGreaterThan(Math.min(boundaries.zMin, boundaries.zMax));
        expect(targetZ).toBeLessThanOrEqual(Math.max(boundaries.zMin, boundaries.zMax));
    });

    it('should maintain deterministic interleaving (Happy/Other) in a single run', () => {
        // Check first 10 biomes
        let currentZ = 0;
        for (let i = 0; i < 10; i++) {
            const type = biomeManager.getBiomeType(currentZ);
            const boundaries = biomeManager.getBiomeBoundaries(currentZ);

            if (i % 2 === 0) {
                expect(type).toBe('happy');
            } else {
                expect(type).not.toBe('happy');
            }

            // Move to next biome
            currentZ = Math.min(boundaries.zMin, boundaries.zMax) - 1;
        }
    });

    it('should refill the deck when empty', () => {
        // Non-happy biomes are 5 types. 
        // Drawing 5 times should empty the deck.
        // Drawing a 6th time should refill and succeed.

        // Total 11 biomes: Happy, Other, Happy, Other, Happy, Other, Happy, Other, Happy, Other, Happy, Other
        // We need 6 "Other" biomes to trigger a refill.

        let currentZ = 0;
        const typesSeen: string[] = [];

        for (let i = 0; i < 12; i++) { // 12 biomes = 6 happy + 6 other
            const type = biomeManager.getBiomeType(currentZ);
            const boundaries = biomeManager.getBiomeBoundaries(currentZ);
            if (type !== 'happy') {
                typesSeen.push(type);
            }
            currentZ = Math.min(boundaries.zMin, boundaries.zMax) - 1;
        }

        expect(typesSeen.length).toBe(6);
        // All biomes should be valid
        typesSeen.forEach(t => expect(t).toBeDefined());
    });

    it('should prune old biomes without breaking neighbors', () => {
        biomeManager.ensureZReached(-10000);
        const initialCount = (biomeManager as any).activeInstances.length;

        // Move to -10000 and prune
        biomeManager.pruneActiveInstances(-10000);

        const prunedCount = (biomeManager as any).activeInstances.length;
        expect(prunedCount).toBeLessThan(initialCount);

        // Biome at -10000 should still be retrievable (it will re-generate if needed, 
        // but prune threshold is 5000, so it should still be there)
        expect(biomeManager.getBiomeType(-10000)).toBeDefined();
    });
});
