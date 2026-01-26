import { PlantConfig } from './LSystemPlantGenerator';

export type LSystemFlowerKind = 'daisy' | 'lily';

export type PetalKind = 'rectangle' | 'kite';

export interface RectangleFlowerPetalParams {
    kind: 'rectangle';
    size: number;
    length: number;
}

export interface KiteFlowerPetalParams {
    kind: 'kite';
    width: number;
    length: number;
    widestPointFraction: number; // 0 to 1
}

export type FlowerPetalParams = RectangleFlowerPetalParams | KiteFlowerPetalParams;

export interface FlowerCenterParams {
    kind: 'center';
    size: number;
    thickness: number;
    offset?: number;
}

export type FlowerPartParams = FlowerPetalParams | FlowerCenterParams;

export interface FlowerVisuals {
    petals: FlowerPetalParams;
    center?: FlowerCenterParams;
    leafColor?: number;
    leafVariation?: { h: number, s: number, l: number };
    woodColor?: number;
    centerColor?: number;
}

export interface FlowerConfig extends PlantConfig {
    visuals: FlowerVisuals;
}

export const ARCHETYPES: Record<LSystemFlowerKind, FlowerConfig> = {
    daisy: {
        visuals: {
            petals: { kind: 'rectangle', size: 0.4, length: 1.0 },
            center: { kind: 'center', size: 0.5, thickness: 0.1, offset: 0.2 },
            leafColor: 0xffffff, // White petals
            woodColor: 0x4CAF50, // Green stalk
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
            '+': { kind: 'petal' },
            '*': { kind: 'center' },
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
            petals: { kind: 'kite', width: 0.8, length: 1.5, widestPointFraction: 0.3 },
            center: { kind: 'center', size: 0.3, thickness: 0.1, offset: 0.1 },
            leafColor: 0xffb6c1, // Light pink
            woodColor: 0x4CAF50,
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
            '.': { scale: 0.0, spread: 40 },
        },
        leaves: {
            '+': { kind: 'petal' },
            '*': { kind: 'center' },
        },
        params: {
            iterations: 8,
            length: 1.0, lengthDecay: 0.9,
            thickness: 0.1, thicknessDecay: 1.0,
        },
        defaults: {
            branch: {},
        }
    }
};
