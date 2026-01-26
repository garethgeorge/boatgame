import { PlantConfig, Turtle } from './LSystemPlantGenerator';

export type LSystemFlowerKind = 'daisy' | 'lily' | 'waterlily';

export interface RectangleFlowerPetalParams {
    kind: 'rectangle';
    size: number;
    length: number;
    variation?: { h: number, s: number, l: number };
    lGradient?: [number, number]; // [base, tip] lightness adjustment
}

export interface KiteFlowerPetalParams {
    kind: 'kite';
    width: number;
    length: number;
    middle: number; // 0 to 1 position of widest part
    bend?: number;  // in degrees
    variation?: { h: number, s: number, l: number };
    lGradient?: [number, number]; // [base, tip] lightness adjustment
}

export interface FlowerCenterParams {
    kind: 'center';
    size: number;
    thickness: number;
    offset?: number;
    variation?: { h: number, s: number, l: number };
}

export type FlowerPartKind = 'rectangle' | 'kite' | 'center';

export type FlowerPartParams =
    RectangleFlowerPetalParams |
    KiteFlowerPetalParams |
    FlowerCenterParams;

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
            // base has a piece of stalk
            'B': { successor: "-S" },
            // stalk grows a couple more steps with kinks
            'S': { successors: ["-/[&U]", "-//[&U]", "U"] },
            'U': { successors: ["-/[&F]", "-//[&F]"] },
            // flower head
            // first #& adds top of stalk and tilts out 80 degrees from stalk
            // the . is a 0 length pseudo-branch for petals, it defines the angle they get attached at
            // each / rotates the turtle around the pseudo-branch axis 
            // each petal is [&+] the & rotates it out from the pseudo-branch
            // the * adds the flower center
            'F': { successor: "#&.*[&+]/[&+]/[&+]/[&+]/[&+]/[&+]/[&+]/[&+]" }
        },
        branches: {
            '-': { scale: 1.0, spread: 15, jitter: 10 },
            '#': { scale: 1.0, spread: 75, jitter: 10 },
            // Pseudo branch for attaching petals
            '.': { scale: 0.0, spread: 75, jitter: 5 },
        },
        leaves: {
            '+': { kind: 'rectangle', size: 0.4, length: 1.0 },
            '*': { kind: 'center', size: 0.5, thickness: 0.1, offset: 0.2 },
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
        axiom: "B",
        rules: {
            // base optionally splits
            'B': { successors: ["=S", "=[=S]/[&=S]", "=[&=S]/[&=S]"] },
            // stem has some wiggle then flower
            'S': { successor: "-/[&F]" },
            // Flower head some stalk, bend 45, center and ring of 6 petals
            'F': { successor: "#&.*[&+]/[&+]/[&+]/[&+]/[&+]/[&+]" }
        },
        branches: {
            '=': { spread: 20 },
            '-': { spread: 10 },
            '#': { spread: 45 },
            '.': { scale: 0.0, spread: 30 },
        },
        leaves: {
            '+': { kind: 'kite', width: 1.0, length: 2.0, middle: 0.6, bend: 35, lGradient: [0.3, 0] },
            '*': { kind: 'center', size: 0.3, thickness: 0.1, offset: 0.1 },
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
                        turtle.bend({ spread: 23 * r, jitter: 6 }).leaf(petal);
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
