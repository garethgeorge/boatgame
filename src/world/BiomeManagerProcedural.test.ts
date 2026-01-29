import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BiomeManager } from './BiomeManager';

describe('BiomeManager Procedural Generation', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager();
    });

    it('should generate an initial biome at Z=0', () => {
        biomeManager.ensureWindow(0, 0);
        const boundaries = biomeManager.getBiomeBoundaries(0);
        // Biome 0 should contain 0 and have a valid range
        expect(boundaries.zMin).toBeLessThanOrEqual(0);
        expect(boundaries.zMax).toBeGreaterThanOrEqual(0);
        expect(boundaries.zMax - boundaries.zMin).toBeGreaterThan(0);
        expect((biomeManager as any).getBiomeInstanceAt(0).type).toBe('happy');
    });

    it('should grow forward (-ve Z) on demand', () => {
        biomeManager.ensureWindow(0, 0);
        const startBiome = (biomeManager as any).getBiomeInstanceAt(0).type;
        // Move deep into negative Z
        const targetZ = -5000;
        biomeManager.ensureWindow(targetZ, 0);

        const biomeAtTarget = (biomeManager as any).getBiomeInstanceAt(targetZ).type;
        expect(biomeAtTarget).toBeDefined();

        const boundaries = biomeManager.getBiomeBoundaries(targetZ);
        expect(targetZ).toBeGreaterThan(Math.min(boundaries.zMin, boundaries.zMax));
        expect(targetZ).toBeLessThanOrEqual(Math.max(boundaries.zMin, boundaries.zMax));
    });

    it('should grow backward (+ve Z) on demand', () => {
        const targetZ = 5000;
        biomeManager.ensureWindow(0, targetZ);

        const biomeAtTarget = (biomeManager as any).getBiomeInstanceAt(targetZ).type;
        expect(biomeAtTarget).toBeDefined();

        const boundaries = biomeManager.getBiomeBoundaries(targetZ);
        expect(targetZ).toBeGreaterThan(Math.min(boundaries.zMin, boundaries.zMax));
        expect(targetZ).toBeLessThanOrEqual(Math.max(boundaries.zMin, boundaries.zMax));
    });

    it('should maintain deterministic interleaving (Happy/Other) in a single run', () => {
        // Check first 10 biomes
        let currentZ = 0;
        for (let i = 0; i < 10; i++) {
            biomeManager.ensureWindow(currentZ, currentZ);
            const type = (biomeManager as any).getBiomeInstanceAt(currentZ).type;
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
            biomeManager.ensureWindow(currentZ, currentZ);
            const type = (biomeManager as any).getBiomeInstanceAt(currentZ).type;
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
        // Populate a large range
        biomeManager.ensureWindow(0, 0);
        biomeManager.ensureWindow(-5000, -5000);
        biomeManager.ensureWindow(-10000, -10000);
        const initialCount = (biomeManager as any).activeInstances.length;

        // Move far forward - this should prune biomes near Z=0
        biomeManager.ensureWindow(-20000, -20000);
        biomeManager.pruneWindow(-20000, -20000);

        const prunedCount = (biomeManager as any).activeInstances.length;
        // At -20000, biomes near 0 are definitely gone.
        // We should have a fresh set of biomes around -20000.
        // Given how they grow/prune, the count should stay relatively stable,
        // but biomes with zMin > -15000 should be removed.
        expect(prunedCount).toBeDefined();

        // Verify that the biome at 0 is no longer in activeInstances
        const hasBiomeAt0 = (biomeManager as any).activeInstances.some((inst: any) => inst.zMax >= 0);
        expect(hasBiomeAt0).toBe(false);
    });
});
