import { describe, it, expect } from 'vitest';
import { CoreMath } from './CoreMath';

describe('CoreMath', () => {
    describe('createUniformRNG', () => {
        it('should be deterministic for a given seed', () => {
            const seed = 12345;
            const rng1 = CoreMath.createUniformRNG(seed);
            const rng2 = CoreMath.createUniformRNG(seed);

            for (let i = 0; i < 100; i++) {
                expect(rng1()).toBe(rng2());
            }
        });

        it('should produce different values for different seeds', () => {
            const rng1 = CoreMath.createUniformRNG(123);
            const rng2 = CoreMath.createUniformRNG(456);

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
            const rng = CoreMath.createUniformRNG(42);
            for (let i = 0; i < 1000; i++) {
                const val = rng();
                expect(val).toBeGreaterThanOrEqual(0);
                expect(val).toBeLessThan(1);
            }
        });

        it('should be roughly uniform', () => {
            const rng = CoreMath.createUniformRNG(99);
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
            const uniformRNG = CoreMath.createUniformRNG(1);
            const gaussianRNG = CoreMath.createGaussianRNG(uniformRNG);
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
            const gaussianRNG = CoreMath.createGaussianRNG(mockUniform);

            const val = gaussianRNG();
            expect(Number.isFinite(val)).toBe(true);
        });

        it('should handle u1=1 safely by returning 0', () => {
            // Mock a uniform RNG that returns 0 exactly (which would make 1.0 - random() = 1.0)
            const mockUniform = () => 0;
            const gaussianRNG = CoreMath.createGaussianRNG(mockUniform);

            const val = gaussianRNG();
            expect(val).toBeCloseTo(0);
        });
    });

    describe('findClosestPoint', () => {
        it('should find the closest point on a constant horizontal line', () => {
            // f(y) = 5
            const f = () => 5;
            const px = 0;
            const py = 0;
            const result = CoreMath.findClosestPoint(f, px, py, 1e-4);

            expect(result.x).toBe(5);
            expect(result.y).toBeCloseTo(0, 3);
            expect(result.distSq).toBeCloseTo(25, 3);
        });

        it('should find the closest point on a linear line', () => {
            // x = y
            const f = (y: number) => y;
            const px = 1;
            const py = 0;
            const result = CoreMath.findClosestPoint(f, px, py, 1e-4);

            // Perpendicular from (1, 0) to x=y is (0.5, 0.5)
            expect(result.x).toBeCloseTo(0.5, 3);
            expect(result.y).toBeCloseTo(0.5, 3);
            expect(result.distSq).toBeCloseTo(0.5, 3);
        });

        it('should find the closest point on a quadratic curve', () => {
            // x = y^2
            const f = (y: number) => y * y;
            const px = 2;
            const py = 0;
            const result = CoreMath.findClosestPoint(f, px, py, 1e-4);

            // f(y) = y^2, target (2, 0)
            // Roots: y=0, y=sqrt(1.5), y=-sqrt(1.5)
            // D(sqrt(1.5)) = 1.75
            expect(Math.abs(result.y)).toBeCloseTo(Math.sqrt(1.5), 3);
            expect(result.x).toBeCloseTo(1.5, 3);
            expect(result.distSq).toBeCloseTo(1.75, 3);
        });

        it('should handle automatic interval selection for distant points', () => {
            // x = 0
            const f = () => 0;
            const px = 100;
            const py = 1000;
            const result = CoreMath.findClosestPoint(f, px, py, 1e-4);

            expect(result.x).toBe(0);
            expect(result.y).toBeCloseTo(1000, 3);
            expect(result.distSq).toBeCloseTo(10000, 3);
        });

        it('should handle sinusoidal curves', () => {
            // x = sin(y)
            const f = (y: number) => Math.sin(y);
            const px = 2;
            const py = Math.PI / 2;
            const result = CoreMath.findClosestPoint(f, px, py, 1e-4);

            // At y=PI/2, sin(y)=1. Nearest point to (2, PI/2) should be (1, PI/2)
            expect(result.x).toBeCloseTo(1, 3);
            expect(result.y).toBeCloseTo(Math.PI / 2, 3);
            expect(result.distSq).toBeCloseTo(1, 3);
        });
    });
});
