import { describe, it, expect } from 'vitest';
import { MathUtils } from './MathUtils';

describe('MathUtils', () => {
    describe('createUniformRNG', () => {
        it('should be deterministic for a given seed', () => {
            const seed = 12345;
            const rng1 = MathUtils.createUniformRNG(seed);
            const rng2 = MathUtils.createUniformRNG(seed);

            for (let i = 0; i < 100; i++) {
                expect(rng1()).toBe(rng2());
            }
        });

        it('should produce different values for different seeds', () => {
            const rng1 = MathUtils.createUniformRNG(123);
            const rng2 = MathUtils.createUniformRNG(456);

            // They might coincidentally hit the same value, but over 5 samples they should diverge
            let different = false;
            for (let i = 0; i < 5; i++) {
                if (rng1() !== rng2()) {
                    different = true;
                    break;
                }
            }
            expect(different).toBe(true);
        });

        it('should produce values in range [0, 1)', () => {
            const rng = MathUtils.createUniformRNG(42);
            for (let i = 0; i < 1000; i++) {
                const val = rng();
                expect(val).toBeGreaterThanOrEqual(0);
                expect(val).toBeLessThan(1);
            }
        });

        it('should be roughly uniform', () => {
            const rng = MathUtils.createUniformRNG(99);
            const numSamples = 10000;
            const numBins = 10;
            const bins = new Array(numBins).fill(0);

            for (let i = 0; i < numSamples; i++) {
                const val = rng();
                const binIdx = Math.floor(val * numBins);
                bins[binIdx]++;
            }

            const expectedCount = numSamples / numBins;
            const tolerance = expectedCount * 0.15; // 15% tolerance for 10k samples

            bins.forEach(count => {
                expect(count).toBeGreaterThan(expectedCount - tolerance);
                expect(count).toBeLessThan(expectedCount + tolerance);
            });
        });
    });

    describe('createGaussianRNG', () => {
        it('should produce values with roughly mean 0 and variance 1', () => {
            const uniformRNG = MathUtils.createUniformRNG(1);
            const gaussianRNG = MathUtils.createGaussianRNG(uniformRNG);
            const numSamples = 10000;

            let sum = 0;
            const samples: number[] = [];

            for (let i = 0; i < numSamples; i++) {
                const val = gaussianRNG();
                sum += val;
                samples.push(val);
            }

            const mean = sum / numSamples;
            expect(mean).toBeGreaterThan(-0.1);
            expect(mean).toBeLessThan(0.1);

            let sumSqDiff = 0;
            for (const val of samples) {
                sumSqDiff += (val - mean) ** 2;
            }
            const variance = sumSqDiff / numSamples;
            expect(variance).toBeGreaterThan(0.9);
            expect(variance).toBeLessThan(1.1);
        });

        it('should handle u1=0 safely by returning a finite number', () => {
            // Mock a uniform RNG that returns 1.0 exactly (which would make 1.0 - random() = 0)
            const mockUniform = () => 1.0;
            const gaussianRNG = MathUtils.createGaussianRNG(mockUniform);

            const val = gaussianRNG();
            expect(Number.isFinite(val)).toBe(true);
        });

        it('should handle u1=1 safely by returning 0', () => {
            // Mock a uniform RNG that returns 0 exactly (which would make 1.0 - random() = 1.0)
            const mockUniform = () => 0;
            const gaussianRNG = MathUtils.createGaussianRNG(mockUniform);

            const val = gaussianRNG();
            expect(val).toBeCloseTo(0);
        });
    });
});
