import { KiteFlowerPetalParams } from './LSystemPartParams';
import { PlantConfig, Turtle } from './LSystemPlantGenerator';

export type LSystemFlowerKind = 'daisy' | 'lily' | 'waterlily';

export interface FlowerVisuals {
    petalColor?: number;
    stalkColor?: number;
    centerColor?: number;
}

export interface FlowerConfig extends PlantConfig {
    visuals: FlowerVisuals;
}

export const ARCHETYPES: Record<LSystemFlowerKind, FlowerConfig> = {
    daisy: {
        visuals: {
            petalColor: 0xffffff, // White petals
            stalkColor: 0x4CAF50, // Green stalk
            centerColor: 0xFFD700, // Gold center
        },
        axiom: "B",
        rules: {
            // base has a piece of stalk, two squiggly bits and a flower
            'B': { successors: ["!/!=$$=F", "!//!=$=F"] },
        },
        symbols: {
            // straight branch that favors being upright
            '=': (turtle: Turtle) => { turtle.branch({ heliotropism: 0.6 }); },
            // squiggly branch (picks a random facing and then bends)
            '$': (turtle: Turtle) => {
                const r = Math.random();
                if (r < 0.33) {
                    turtle.rotate().bend({ spread: 15, jitter: 10 }).branch();
                } if (r < 0.66) {
                    turtle.rotate().rotate().bend({ spread: 15, jitter: 10 }).branch();
                } else {
                    turtle.branch();
                }
            },
            // leaf
            '!': (turtle: Turtle) => {
                turtle.push();
                turtle.bend({ spread: 20, jitter: 5 }).branch({
                    scale: 1, opts: { kind: 'rectangle', widthScale: [1, 4] }
                });
                turtle.bend({ spread: 10, jitter: 5 }).branch({
                    scale: 1.5, opts: { kind: 'rectangle', widthScale: [4, 3] }
                });
                turtle.bend({ spread: 10, jitter: 5 }).branch({
                    scale: 1, weight: 1, opts: { kind: 'rectangle', widthScale: [3, 1] }
                });
                turtle.pop();
            },
            // flower
            'F': (turtle: Turtle) => {
                turtle.bend({ spread: 80 });
                turtle.leaf({
                    weight: 0.2,
                    geomIndex: 2,
                    opts: {
                        kind: 'center', size: 0.5, thickness: 0.1, offset: 0.2
                    }
                });
                for (let i = 0; i < 8; i++) {
                    turtle.rotate();
                    turtle.push();
                    turtle.bend({ spread: 75, jitter: 5 }).leaf({
                        weight: 0.2,
                        opts: {
                            kind: 'rectangle', size: 0.4, length: 1.0
                        }
                    });
                    turtle.pop();
                }
            }
        },
        params: {
            iterations: 10,
            length: 0.75, lengthDecay: 0.8,
            thickness: 0.08, thicknessDecay: 1.0,
        },
        defaults: {
            branch: {
                jitter: 0, gravity: 0.0
            },
        }
    },

    lily: {
        visuals: {
            petalColor: 0xffb6c1, // Light pink
            stalkColor: 0x4CAF50,
            centerColor: 0xFFD700,
        },
        axiom: "!/!/!B",
        rules: {
            'B': {
                successors: [
                    "===F", // straight stem
                    "=[===F]/[&==F]", // one straight and side split
                    "=[&===F]/[&==F]" // y split
                ]
            },
        },
        symbols: {
            // Stem. = adds to stem, & branches off at 20 degrees
            '=': (turtle: Turtle) => { turtle.branch(); },
            '&': (turtle: Turtle) => { turtle.bend({ spread: 20 }); },
            '/': (turtle: Turtle) => { turtle.rotate({ jitter: 20 }); },
            // leaf
            '!': (turtle: Turtle) => {
                turtle.push();
                turtle.bend({ spread: 15, jitter: 5 }).branch({
                    scale: 1, opts: { kind: 'rectangle', widthScale: [1, 4] }
                });
                turtle.bend({ spread: 5, jitter: 3 }).branch({
                    scale: 3.0, opts: { kind: 'rectangle', widthScale: [4, 3] }
                });
                turtle.bend({ spread: 5, jitter: 3 }).branch({
                    scale: 1, weight: 1, opts: { kind: 'rectangle', widthScale: [3, 1] }
                });
                turtle.pop();
            },
            // Flower head
            'F': (turtle: Turtle) => {
                turtle.bend({ spread: 45 });
                turtle.leaf({
                    weight: 0.2,
                    geomIndex: 2,
                    opts: {
                        kind: 'center', size: 0.3, thickness: 0.1, offset: 0.1
                    }
                });
                for (let i = 0; i < 6; i++) {
                    turtle.rotate();
                    turtle.push();
                    turtle.bend({ spread: 30 }).leaf({
                        weight: 0.2,
                        opts: {
                            kind: 'kite', width: 1.0, length: 2.0, middle: 0.6, bend: 35,
                            lGradient: [0.3, 0]
                        }
                    });
                    turtle.pop();
                }
            }
        },
        params: {
            iterations: 8,
            length: 1.0, lengthDecay: 0.9,
            thickness: 0.1, thicknessDecay: 1.0,
        },
        defaults: {
            branch: {},
        }
    },

    waterlily: {
        visuals: {
            petalColor: 0xffb6c1, // Light pink
        },
        axiom: "F",
        symbols: {
            'F': (turtle: Turtle) => {
                //turtle.enableLogging();
                for (let r = 0; r < 4; r++) {
                    if (r == 1) continue;

                    // Petals get longer in outer rings
                    const scale = 0.8 + 0.2 * (r / 3);
                    // Petals get lighter in inner rings
                    const baseL = 0.3 * (r / 3);
                    const petal: KiteFlowerPetalParams = {
                        kind: 'kite', width: 1.0, length: 3.0 * scale, middle: 0.6, bend: -20,
                        lGradient: [baseL + 0.15, baseL] // Lighter at base
                    };

                    // 4, (5), 6, 7 petals = total 17
                    for (let i = 0; i < 4 + r; i++) {
                        turtle.rotate()
                        turtle.push();
                        turtle.bend({ spread: 23 * r, jitter: 6 }).leaf({ opts: petal });
                        turtle.pop();
                    }
                }
            }
        },
        params: {
            iterations: 8,
            length: 1.0, lengthDecay: 0.9,
            thickness: 0.1, thicknessDecay: 1.0,
        },
        defaults: {
            branch: {},
        }
    },
};
