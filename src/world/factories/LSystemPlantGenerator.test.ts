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
                    wind: new THREE.Vector3(), windForce: 0, antiShadow: 0,
                    weight: 0
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

        it('should pass through branch opts to BranchData', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: 'X',
                params: {
                    iterations: 1,
                    length: 1, lengthDecay: 1,
                    thickness: 0.1, thicknessDecay: 1
                },
                symbols: {
                    'X': (turtle: Turtle) => turtle.branch({ opts: { foo: 'bar' } })
                },
                defaults: {
                    branch: { scale: 1 } as any
                }
            };

            plant.generate(config);
            expect(plant.branches.length).toBe(1);
            expect(plant.branches[0].opts).toEqual({ foo: 'bar' });
        });
    });

    describe('Weights and Load Calculation', () => {
        const createMultiSegmentConfig = (leafWeight: number, branchWeight: number) => ({
            axiom: '--+',
            params: {
                iterations: 1,
                length: 1, lengthDecay: 1,
                thickness: 1.0, thicknessDecay: 0.5
            },
            symbols: {
                '-': (turtle: Turtle) => turtle.branch({ weight: branchWeight }),
                '+': (turtle: Turtle) => turtle.leaf({ weight: leafWeight })
            },
            defaults: { branch: { scale: 1, weight: 0 } as any }
        });

        it('should account for leaf weights in multi-segment branches', () => {
            const plant = new ProceduralPlant();

            // Case A: leaf=1. B2 load = 1. B1 load = 1.
            plant.generate(createMultiSegmentConfig(1, 0));
            expect(plant.branches[1].radiusStart / plant.branches[0].radiusStart).toBeCloseTo(1.0, 2);

            // Case B: leaf=4. B2 load = 4. B1 load = 4.
            plant.generate(createMultiSegmentConfig(4, 0));
            expect(plant.branches[1].radiusStart / plant.branches[0].radiusStart).toBeCloseTo(1.0, 2);

            // Note: Since both B1 and B2 have same load, radius same.
        });

        it('should account for branch weights in multi-segment branches', () => {
            const plant = new ProceduralPlant();

            // Explicitly build a 2-segment plant:
            // segment 1 (B1): root -> N1. weight = 3.
            // segment 2 (B2): N1 -> N2. weight = 0.
            // leaf at N2: weight = 1.

            const config: PlantConfig = {
                axiom: 'X',
                params: {
                    iterations: 1,
                    length: 1, lengthDecay: 1,
                    thickness: 1.0, thicknessDecay: 0.5
                },
                symbols: {
                    'X': (turtle: Turtle) => {
                        turtle.branch({ weight: 3 }); // B1
                        turtle.branch({ weight: 0 }); // B2
                        turtle.leaf({ weight: 1 });
                    }
                },
                defaults: { branch: { scale: 1, weight: 0 } as any }
            };

            plant.generate(config);
            expect(plant.branches.length).toBe(2);
            // root.load = calculateLoad(N1) + N1.branchWeight = 1 + 3 = 4.
            // N1.load = calculateLoad(N2) + N2.branchWeight = 1 + 0 = 1.

            // B1 starts at root (radiusStart propto sqrt(4))
            // B2 starts at N1 (radiusStart propto sqrt(1))
            expect(plant.branches[1].radiusStart / plant.branches[0].radiusStart).toBeCloseTo(Math.sqrt(1 / 4), 2);
        });

        it('should propagate multi-level branch weights correctly', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: '-', // Trunk
                params: {
                    iterations: 1,
                    length: 1, lengthDecay: 1,
                    thickness: 1.0, thicknessDecay: 0.5
                },
                symbols: {
                    '-': (turtle: Turtle) => {
                        turtle.branch({ weight: 1 }).push();
                        turtle.branch({ weight: 1 }).leaf({ weight: 1 }).pop();
                    }
                },
                defaults: { branch: { scale: 1, weight: 0 } as any }
            };

            plant.generate(config);
            // Branch 1 (B1): child of root. branchWeight=1. supports child B2.
            // Branch 2 (B2): child of B1 end node. branchWeight=1. supports leaf w=1.

            // B2 end node load = leafWeightSum(1). B2.load = 1.
            // B1 end node load = B2.load + B2.branchWeight (1) = 1 + 1 = 2. B1.load = 2.
            // root load = B1.load + B1.branchWeight (1) = 2 + 1 = 3.

            expect(plant.branches.length).toBe(2);
            const rootRadius = plant.branches[0].radiusStart;
            const child1Radius = plant.branches[1].radiusStart;

            // rootRadius = scaler * sqrt(3)
            // child1Radius = scaler * sqrt(2)
            expect(rootRadius / child1Radius).toBeCloseTo(Math.sqrt(3 / 2), 2);
        });
    });

    describe('Gravity Distribution', () => {
        it('should maintain radial distribution when gravity is applied', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: 'X',
                params: {
                    iterations: 1,
                    length: 1, lengthDecay: 1,
                    thickness: 0.1, thicknessDecay: 1
                },
                symbols: {
                    'X': (turtle: Turtle) => {
                        // Create 4 branches pointing in cardinal directions (N, S, E, W)
                        // North
                        turtle.push().bend({ spread: 90 }).branch({ gravity: 0.5 }).pop();
                        // East
                        turtle.push().rotate({ angle: 90 }).bend({ spread: 90 }).branch({ gravity: 0.5 }).pop();
                        // South
                        turtle.push().rotate({ angle: 180 }).bend({ spread: 90 }).branch({ gravity: 0.5 }).pop();
                        // West
                        turtle.push().rotate({ angle: 270 }).bend({ spread: 90 }).branch({ gravity: 0.5 }).pop();
                    }
                },
                defaults: { branch: { scale: 1, gravity: 0 } as any }
            };

            plant.generate(config);

            expect(plant.branches.length).toBe(4);

            // Collect the end positions of the 4 branches
            const ends = plant.branches.map(b => b.end);

            const distNS = ends[0].distanceTo(ends[2]);
            const distEW = ends[1].distanceTo(ends[3]);

            console.log('Dist NS (High Gravity - Post Fix):', distNS);
            console.log('Dist EW (High Gravity - Post Fix):', distEW);

            // With strength 0.95, if they were converging they would be < 0.2 apart.
            // With the fix, they should maintain radial distribution.
            expect(distNS).toBeGreaterThan(0.5);
            expect(distEW).toBeGreaterThan(0.5);
        });
    });

    describe('Branch Orientation', () => {
        it('should preserve roll orientation in branch topology', () => {
            const plant = new ProceduralPlant();
            const config: PlantConfig = {
                axiom: 'X',
                params: {
                    iterations: 1,
                    length: 1, lengthDecay: 1,
                    thickness: 0.1, thicknessDecay: 1
                },
                symbols: {
                    'X': (turtle: Turtle) => {
                        // rotate 90 around Y (yaw), then bend 90 around X (pitch)
                        turtle.rotate({ angle: 90 }).bend({ spread: 90 }).branch();
                    }
                },
                defaults: { branch: { scale: 1, jitter: 0 } as any }
            };

            plant.generate(config);

            expect(plant.branches.length).toBe(1);
            const branch = plant.branches[0] as any;

            // Expected quaternion: Identity * RotateY(90) * RotateX(90)
            const expectedQuat = new THREE.Quaternion()
                .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2))
                .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));

            // The branch should have this orientation
            // We need to add 'quat' to BranchData first for this test to pass
            expect(branch.quat).toBeDefined();

            // Allow for small floating point differences
            expect(branch.quat.x).toBeCloseTo(expectedQuat.x);
            expect(branch.quat.y).toBeCloseTo(expectedQuat.y);
            expect(branch.quat.z).toBeCloseTo(expectedQuat.z);
            expect(branch.quat.w).toBeCloseTo(expectedQuat.w);
        });
    });
});

