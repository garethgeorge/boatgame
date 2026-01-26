import { describe, it, expect } from 'vitest';
import { ProceduralPlant, PlantConfig, Turtle } from './LSystemPlantGenerator';
import * as THREE from 'three';

describe('ProceduralPlant', () => {
    it('should reset branches and leaves between generations even without rules', () => {
        const plant = new ProceduralPlant();

        const configWithRules: PlantConfig = {
            axiom: 'A',
            rules: {
                'A': { successor: '-+' }
            },
            branches: {
                '-': { scale: 1.0 }
            },
            leaves: {
                '+': {}
            },
            params: {
                iterations: 2,
                length: 1.0, lengthDecay: 1.0,
                thickness: 0.1, thicknessDecay: 1.0
            },
            defaults: {
                branch: { spread: 0, jitter: 0, scale: 1.0, gravity: 0, horizonBias: 0, heliotropism: 0, wind: new THREE.Vector3(), windForce: 0, antiShadow: 0 }
            }
        };

        const configWithoutRules: PlantConfig = {
            axiom: 'F',
            symbols: {
                'F': () => { /* do nothing */ }
            },
            params: {
                iterations: 1,
                length: 1.0, lengthDecay: 1.0,
                thickness: 0.1, thicknessDecay: 1.0
            },
            defaults: {
                branch: { spread: 0, jitter: 0, scale: 1.0, gravity: 0, horizonBias: 0, heliotropism: 0, wind: new THREE.Vector3(), windForce: 0, antiShadow: 0 }
            }
        };

        // First generation should have branches and leaves
        plant.generate(configWithRules);
        expect(plant.branches.length).to.be.greaterThan(0);
        expect(plant.leaves.length).to.be.greaterThan(0);

        // Second generation with no rules should be empty
        plant.generate(configWithoutRules);
        expect(plant.branches.length).toBe(0);
        expect(plant.leaves.length).toBe(0);
    });

    describe('Grammar Expansion', () => {
        it('should expand rules deterministically', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: 'A',
                rules: {
                    'A': { successor: 'AB' },
                    'B': { successor: 'A' }
                },
                params: {
                    iterations: 3,
                    length: 1, lengthDecay: 1,
                    thickness: 0.1, thicknessDecay: 1
                },
                defaults: { branch: { scale: 1 } as any }
            };

            // i=0: current='A', isLast=false -> next='AB'
            // i=1: current='AB', isLast=false -> next='ABA'
            // i=2: current='ABA', isLast=true -> next='XXX'

            config.finalRule = 'X';
            config.leaves = { 'X': {} };
            plant.generate(config);
            expect(plant.leaves.length).toBe(3);
        });

        it('should use stochastic rules', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: 'A',
                rules: {
                    'A': { successors: ['B', 'C'], weights: [0.5, 0.5] }
                },
                leaves: { 'B': {}, 'C': {} },
                params: {
                    iterations: 2, // 1st iteration: A -> B or C. 2nd: B or C -> B or C (no rule)
                    length: 1, lengthDecay: 1,
                    thickness: 0.1, thicknessDecay: 1
                },
                defaults: { branch: { scale: 1 } as any }
            };

            plant.generate(config);
            // i=0: isLast=false -> A becomes B or C. current = B or C.
            // i=1: isLast=true -> B or C has no rule -> remains B or C.
            expect(plant.leaves.length).toBe(1);
        });
    });

    describe('Turtle Graphics', () => {
        const createBaseConfig = (): PlantConfig => ({
            axiom: '',
            params: {
                iterations: 1,
                length: 1, lengthDecay: 1,
                thickness: 0.1, thicknessDecay: 1
            },
            defaults: {
                branch: {
                    spread: 45, jitter: 0, scale: 1,
                    gravity: 0, horizonBias: 0, heliotropism: 0,
                    wind: new THREE.Vector3(), windForce: 0, antiShadow: 0
                }
            }
        });

        it('should create branches with symbol rules', () => {
            const plant = new ProceduralPlant();
            const config = createBaseConfig();
            config.axiom = 'B';
            config.symbols = {
                'B': (turtle: Turtle) => {
                    turtle.branch({ scale: 1 });
                }
            };

            plant.generate(config);
            expect(plant.branches.length).toBe(1);
            // Vigor pass stretches branches by 1.2x if they are the only child
            expect(plant.branches[0].end.y).toBeCloseTo(1.2);
        });

        it('should handle push/pop correctly', () => {
            const plant = new ProceduralPlant();
            const config = createBaseConfig();
            config.axiom = 'F';
            config.symbols = {
                'F': (turtle: Turtle) => {
                    turtle.branch({ scale: 1 }); // to (0,1,0)
                    turtle.push();
                    turtle.bend({ spread: 90 }).branch({ scale: 1 }); // to (1,1,0)
                    turtle.pop();
                    turtle.branch({ scale: 1 }); // to (0,2,0)
                }
            };

            plant.generate(config);
            expect(plant.branches.length).toBe(3);

            // Vigor pass:
            // Branch 1 has two children (tips B2, B3). B1.leafCount = 0.5 + 0.5 = 1.0.
            // Vigor B1 = 1.0/1.0 = 1.0 -> stretch = 1.2
            // Vigor B2 = 0.5/1.0 = 0.5 -> stretch = 0.2 + 1.0 * sqrt(0.5) = 0.907
            // Vigor B3 = 0.5/1.0 = 0.5 -> stretch = 0.2 + 1.0 * sqrt(0.5) = 0.907
            const b1Stretch = 1.2;
            const b23Stretch = 0.2 + Math.sqrt(0.5);

            // Branch 1: (0,0,0) -> (0, 1.2, 0)
            expect(plant.branches[0].start.y).toBe(0);
            expect(plant.branches[0].end.y).toBeCloseTo(b1Stretch);

            // Branch 2: starts at end of Branch 1, pushed, bent 90 around X (facing (0,0,1)), length ~0.907
            expect(plant.branches[1].start.y).toBeCloseTo(b1Stretch);
            expect(plant.branches[1].end.z).toBeCloseTo(b23Stretch);

            // Branch 3: starts at end of Branch 1, popped (facing (0,1,0)), length ~0.907
            expect(plant.branches[2].start.y).toBeCloseTo(b1Stretch);
            expect(plant.branches[2].end.y).toBeCloseTo(b1Stretch + b23Stretch);
            expect(plant.branches[2].end.x).toBeCloseTo(0);
            expect(plant.branches[2].end.z).toBeCloseTo(0);
        });

        it('should add leaves', () => {
            const plant = new ProceduralPlant();
            const config = createBaseConfig();
            config.axiom = 'L';
            config.symbols = {
                'L': (turtle: Turtle) => {
                    turtle.leaf();
                }
            };

            plant.generate(config);
            expect(plant.leaves.length).toBe(1);
            expect(plant.leaves[0].pos.y).toBe(0);
        });
    });

    describe('Symbol Rules Integration', () => {
        it('should mix built-in symbols with custom symbols', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: '[&L]/[&L]', // Two leaves tilted out and rotated
                params: {
                    iterations: 1,
                    length: 1, lengthDecay: 1,
                    thickness: 0.1, thicknessDecay: 1
                },
                symbols: {
                    'L': (turtle: Turtle) => turtle.leaf(),
                },
                defaults: {
                    branch: { spread: 45, jitter: 0, scale: 1 } as any
                }
            };

            plant.generate(config);
            expect(plant.leaves.length).toBe(2);

            const l1 = plant.leaves[0];
            const l2 = plant.leaves[1];

            // Both should be at origin
            expect(l1.pos.length()).toBe(0);
            expect(l2.pos.length()).toBe(0);

            // Should have different directions due to / (rotate)
            expect(l1.dir.dot(l2.dir)).toBeLessThan(0.99);
        });

        it('should keep default symbols even when user provides some symbol overrides', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: '[X]',
                params: {
                    iterations: 1,
                    length: 1, lengthDecay: 1,
                    thickness: 0.1, thicknessDecay: 1
                },
                symbols: {
                    'X': (turtle: Turtle) => turtle.branch()
                },
                defaults: {
                    branch: { scale: 1 } as any
                }
            };

            plant.generate(config);
            // If [ and ] work, it should have 1 branch
            expect(plant.branches.length).toBe(1);
        });
    });
});
