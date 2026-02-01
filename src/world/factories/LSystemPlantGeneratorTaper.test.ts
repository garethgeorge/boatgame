import { describe, it, expect } from 'vitest';
import { ProceduralPlant, PlantConfig } from './LSystemPlantGenerator';
import * as THREE from 'three';

describe('ProceduralPlant Tapering', () => {
    it('should apply tapering to branches', () => {
        const plant = new ProceduralPlant();
        const config: PlantConfig = {
            axiom: 'F',
            symbols: {
                'F': (turtle) => {
                    turtle.branch({ scale: 1 }); // length 1.2 due to vigor
                }
            },
            params: {
                iterations: 1,
                length: 1, lengthDecay: 1,
                thickness: 1.0, thicknessDecay: 0.5,
                taperRate: 0.1,
                minTwigRadius: 0.05
            }
        };

        plant.generate(config);
        expect(plant.branches.length).toBe(1);
        const branch = plant.branches[0];

        // baseRadius = scaler * (0.5)^0.5 = 1.0 * (1.0)^0.5 = 1.0
        // vigor for single child = 1.2
        // length = 1.2
        // endRadius = 1.0 - (1.2 * 0.1) = 0.88

        expect(branch.radiusStart).toBeCloseTo(1.0);
        expect(branch.radiusEnd).toBeCloseTo(0.88);
    });

    it('should enforce connectivity and not exceed parent end radius', () => {
        const plant = new ProceduralPlant();
        const config: PlantConfig = {
            axiom: 'FF',
            symbols: {
                'F': (turtle) => {
                    turtle.branch({ scale: 1 });
                }
            },
            params: {
                iterations: 1,
                length: 1, lengthDecay: 1,
                thickness: 1.0, thicknessDecay: 0.5,
                taperRate: 0.1,
                minTwigRadius: 0.01
            }
        };

        plant.generate(config);
        expect(plant.branches.length).toBe(2);
        const b1 = plant.branches[0];
        const b2 = plant.branches[1];

        // b1 end radius should match b2 start radius
        expect(b1.radiusEnd).toBeCloseTo(b2.radiusStart);
    });

    it('should respect minTwigRadius floor', () => {
        const plant = new ProceduralPlant();
        const config: PlantConfig = {
            axiom: 'F',
            symbols: {
                'F': (turtle) => {
                    turtle.branch({ scale: 10 }); // very long branch
                }
            },
            params: {
                iterations: 1,
                length: 1, lengthDecay: 1,
                thickness: 1.0, thicknessDecay: 0.5,
                taperRate: 0.5, // aggressive taper
                minTwigRadius: 0.2
            }
        };

        plant.generate(config);
        const branch = plant.branches[0];

        // baseRadius = 1.0
        // length = 10 * 1.2 = 12
        // endRadius = 1.0 - (12 * 0.5) = -5.0 -> floored to 0.2
        expect(branch.radiusEnd).toBe(0.2);
    });
});
