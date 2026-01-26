import * as THREE from 'three';
import { PlantConfig } from './LSystemPlantGenerator';

export type LSystemFlowerKind = 'daisy';

export type PetalKind = 'simple';

export interface SimplePetalKindParams {
    kind: 'simple';
    size: number;
    thickness: number;
    length: number;
}

export type PetalKindParams = SimplePetalKindParams;

export interface FlowerConfig extends PlantConfig {
    petalKind: PetalKindParams;
}

export const ARCHETYPES: Record<LSystemFlowerKind, FlowerConfig> = {
    daisy: {
        petalKind: { kind: 'simple', size: 0.4, thickness: 0.05, length: 1.0 },
        axiom: "S",
        rules: {
            // stalk has some kinks
            'S': { successor: "-&-/&C" },
            // first #& adds top of stalk and tilts out 80 degrees from stalk
            // the . is a 0 length pseudo-branch for petals, it defines the angle they get attached at
            // each / rotates the turtle around the pseudo-branch axis 
            // each petal is [&+] the & rotates it out from the pseudo-branch
            'C': { successor: "#&.[&+]/[&+]/[&+]/[&+]/[&+]/[&+]/[&+]/[&+]" }
        },
        branches: {
            '-': { scale: 1.0, spread: 10, jitter: 5 },
            '#': { scale: 1.0, spread: 75, jitter: 10 },
            // Pseudo branch for attaching petals
            '.': { scale: 0.0, spread: 75, jitter: 5 },
        },
        params: {
            iterations: 10,
            length: 1.0, lengthDecay: 0.7,
            thickness: 0.08, thicknessDecay: 1.0,
            leafColor: 0xffffff, // White petals
            woodColor: 0x4CAF50, // Green stalk
        },
        defaults: {
            branch: {
                jitter: 0, gravity: 0.0
            },
        }
    }
};
