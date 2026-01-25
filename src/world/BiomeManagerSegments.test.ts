
import { describe, it, expect, beforeEach } from 'vitest';
import { BiomeManager } from './BiomeManager';

describe('BiomeManager Segments', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager();
    });

    it('should return a single segment if range is within one biome', () => {
        // Range [-1000, -500] is entirely within Happy [-1500, 0]
        biomeManager.update(-750);
        const segments = biomeManager.getFeatureSegments(-500, -1000);

        expect(segments.length).toBe(1);
        expect(segments[0].zMin).toBe(-500);
        expect(segments[0].zMax).toBe(-1000);
        expect(segments[0].features.id).toBe('happy');
    });

    it('should return multiple segments if range spans biome boundaries', () => {
        // Happy is [-1500, 0]
        // Next neg biome starts at -1500
        // Sample from -1400 to -1600
        biomeManager.update(-1500);
        const segments = biomeManager.getFeatureSegments(-1400, -1600);

        expect(segments.length).toBe(2);

        // First segment (Happy)
        expect(segments[0].features.id).toBe('happy');
        expect(segments[0].zMin).toBe(-1400);
        expect(segments[0].zMax).toBe(-1500);

        // Second segment (Next biome)
        expect(segments[1].features.id).not.toBe('happy');
        expect(segments[1].zMin).toBe(-1500);
        expect(segments[1].zMax).toBe(-1600);
    });

    it('should handle large ranges spanning many biomes', () => {
        biomeManager.update(-2500);
        const segments = biomeManager.getFeatureSegments(0, -5000);

        expect(segments.length).toBeGreaterThan(2);

        // Check continuity
        for (let i = 0; i < segments.length - 1; i++) {
            expect(segments[i].zMax).toBe(segments[i + 1].zMin);
        }

        expect(segments[0].zMin).toBe(0);
        expect(segments[segments.length - 1].zMax).toBe(-5000);
    });

    it('should handle positive Z direction traversal', () => {
        // Range [0, 2000]
        biomeManager.update(1000);
        const segments = biomeManager.getFeatureSegments(0, 2000);

        expect(segments.length).toBeGreaterThan(0);
        for (let i = 0; i < segments.length - 1; i++) {
            expect(segments[i].zMax).toBe(segments[i + 1].zMin);
        }
        expect(segments[0].zMin).toBe(0);
        expect(segments[segments.length - 1].zMax).toBe(2000);
    });
});
