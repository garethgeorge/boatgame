import * as THREE from 'three';
import { PlantConfig } from './LSystemPlantGenerator';

export type LSystemFlowerKind = 'daisy';

export type PetalKind = 'simple';

export interface SimpleFlowerPetalParams {
    kind: 'simple';
    size: number;
    thickness: number;
    length: number;
}

export interface FlowerCenterParams {
    kind: 'center';
    size: number;
    thickness: number;
    offset?: number;
}

export type FlowerPartParams = SimpleFlowerPetalParams | FlowerCenterParams;

export interface FlowerVisuals {
    petals: SimpleFlowerPetalParams;
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
            petals: { kind: 'simple', size: 0.4, thickness: 0.05, length: 1.0 },
            center: { kind: 'center', size: 0.5, thickness: 0.1, offset: 0.2 },
            leafColor: 0xffffff, // White petals
            woodColor: 0x4CAF50, // Green stalk
            centerColor: 0xFFD700, // Gold center
        },
        axiom: "-S",
        rules: {
            // stalk has some kinks
            'S': { successors: ["-/[&U]", "-//[&U]", "U"] },
            'U': { successors: ["-/[&C]", "-//[&C]"] },
            // first #& adds top of stalk and tilts out 80 degrees from stalk
            // the . is a 0 length pseudo-branch for petals, it defines the angle they get attached at
            // each / rotates the turtle around the pseudo-branch axis 
            // each petal is [&+] the & rotates it out from the pseudo-branch
            // the * adds the flower center
            'C': { successor: "#&.*[&+]/[&+]/[&+]/[&+]/[&+]/[&+]/[&+]/[&+]" }
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
    }
};
