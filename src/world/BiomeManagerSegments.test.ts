
import { describe, it, expect, beforeEach } from 'vitest';
import { BiomeManager } from './BiomeManager';

describe('BiomeManager Segments', () => {
    let biomeManager: BiomeManager;

    beforeEach(() => {
        biomeManager = new BiomeManager();
    });

    it('should return a single segment if range is within one biome', () => {
        biomeManager.ensureWindow(0, 0);
        const boundaries = biomeManager.getBiomeBoundaries(0);
        const mid = (boundaries.zMin + boundaries.zMax) / 2;
        const width = (boundaries.zMax - boundaries.zMin) * 0.2;

        const zStart = mid + width;
        const zEnd = mid - width;

        biomeManager.ensureWindow(zEnd, zStart);
        const segments = biomeManager.getFeatureSegments(zStart, zEnd);

        expect(segments.length).toBe(1);
        expect(segments[0].zMin).toBe(zStart);
        expect(segments[0].zMax).toBe(zEnd);
        expect(segments[0].features.id).toBe('happy');
    });

    it('should return multiple segments if range spans biome boundaries', () => {
        biomeManager.ensureWindow(0, 0);
        const boundaries = biomeManager.getBiomeBoundaries(0);
        const transitionZ = boundaries.zMin; // Boundary between first and second biome

        const zStart = transitionZ + 50;
        const zEnd = transitionZ - 50;

        biomeManager.ensureWindow(zEnd, zStart);
        const segments = biomeManager.getFeatureSegments(zStart, zEnd);

        expect(segments.length).toBe(2);

        // First segment (Happy)
        expect(segments[0].features.id).toBe('happy');
        expect(segments[0].zMin).toBe(zStart);
        expect(segments[0].zMax).toBe(transitionZ);

        // Second segment (Next biome)
        expect(segments[1].features.id).not.toBe('happy');
        expect(segments[1].zMin).toBe(transitionZ);
        expect(segments[1].zMax).toBe(zEnd);
    });

    it('should handle large ranges spanning many biomes', () => {
        const targetZ = -5000;
        biomeManager.ensureWindow(targetZ, 0);
        const segments = biomeManager.getFeatureSegments(0, targetZ);

        expect(segments.length).toBeGreaterThan(2);

        // Check continuity
        for (let i = 0; i < segments.length - 1; i++) {
            expect(segments[i].zMax).toBe(segments[i + 1].zMin);
        }

        expect(segments[0].zMin).toBe(0);
        expect(segments[segments.length - 1].zMax).toBe(targetZ);
    });

    it('should handle positive Z direction traversal', () => {
        // Range [0, 2000]
        biomeManager.ensureWindow(0, 2000);
        const segments = biomeManager.getFeatureSegments(0, 2000);

        expect(segments.length).toBeGreaterThan(0);
        for (let i = 0; i < segments.length - 1; i++) {
            expect(segments[i].zMax).toBe(segments[i + 1].zMin);
        }
        expect(segments[0].zMin).toBe(0);
        expect(segments[segments.length - 1].zMax).toBe(2000);
    });
});
