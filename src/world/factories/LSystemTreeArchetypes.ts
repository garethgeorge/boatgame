import * as THREE from 'three';

export type LSystemTreeKind = 'willow' | 'poplar' | 'oak' | 'elm' |
    'umbrella' | 'open' | 'irregular' | 'vase';

export type LeafKind = 'blob' | 'willow' | 'irregular' | 'cluster' | 'umbrella';
export interface BlobLeafKindParams {
    kind: 'blob'; color: number; size: number; thickness: number;
}
export interface WillowLeafKindParams {
    kind: 'willow'; color: number;
};
export interface IrregularLeafKindParams {
    kind: 'irregular'; color: number; size: number; thickness: number;
}
export interface ClusterLeafKindParams {
    kind: 'cluster'; color: number; size: number; thickness: number; leaves: number; leafSize: number;
}
export interface UmbrellaLeafKindParams {
    kind: 'umbrella'; color: number; size: number; leaves: number; leafSize: number;
}
export type LeafKindParams = BlobLeafKindParams | WillowLeafKindParams |
    IrregularLeafKindParams | ClusterLeafKindParams | UmbrellaLeafKindParams;

export interface TreeParams {
    spread?: number;
    jitter?: number;
    length?: number;
    lengthDecay?: number;
    thickness?: number;
    thicknessDecay?: number;

    // shaping parameters
    gravity?: number;
    horizonBias?: number;
    heliotropism?: number;
    wind?: THREE.Vector3;
    antiShadow?: number;
}

export interface ExpansionRuleResult {
    successors?: string[];
    successor?: string;    // Convenience for single successor
    weights?: number[];    // their weights (probabilities)
}

export type ExpansionRuleDefinition = ExpansionRuleResult | ((val: number) => ExpansionRuleResult);

export interface InterpreterRuleResult {
    params?: TreeParams;        // parameters that can override defaults
}

export type InterpreterRuleDefinition = InterpreterRuleResult | ((val: number) => InterpreterRuleResult);

export interface TreeConfig {
    axiom: string;
    rules: Record<string, ExpansionRuleDefinition>;
    interpreter?: Record<string, InterpreterRuleDefinition>;

    // parameters set only once
    iterations: number;
    trunkLengthMultiplier: number;
    leafKind: LeafKindParams;

    // defaults for per rule parameters
    params: TreeParams;
}

export const ARCHETYPES: Record<LSystemTreeKind, TreeConfig> = {
    willow: {
        axiom: "FX",
        rules: {
            'X': (i: number) => {
                if (i <= 3) return { successor: "F[&&X]/[&&X]/[&&X]" };
                return { successors: ["FX", "L"], weights: [0.9, 0.1] };
            }
        },
        iterations: 8,
        params: {
            spread: 22.9, jitter: 11.5,
            length: 3, lengthDecay: 0.8, thickness: 0.7, thicknessDecay: 0.6,
            gravity: -0.25
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'willow', color: 0x41b98d },
    },
    poplar: {
        axiom: "X",
        rules: {
            'X': { successor: "F[&X]/X" }
        },
        iterations: 7,
        params: {
            spread: 5.7, jitter: 2.9,
            length: 2, lengthDecay: 0.75, thickness: 0.5, thicknessDecay: 0.75,
            gravity: 0.15
        },
        trunkLengthMultiplier: 1.2,
        leafKind: { kind: 'blob', color: 0x3ea043, size: 1.0, thickness: 2.5 },
    },
    oak: {
        axiom: "FX",
        rules: {
            'X': (i: number) => {
                if (i <= 2) return { successors: ["F[&X]/[&X]", "F[&X]/[&X]/[&X]"], weights: [0.5, 0.5] };
                return { successors: ["F[&X]/[&X]", "F[&X]/[&X]/[&X]", "L"], weights: [0.4, 0.4, 0.2] };
            }
        },
        iterations: 6,
        params: {
            spread: 63.0, jitter: 17.2,
            length: 4, lengthDecay: 0.8, thickness: 0.9, thicknessDecay: 0.75,
            gravity: -0.05
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'blob', color: 0x228B22, size: 1.8, thickness: 0.6 },
    },
    elm: {
        axiom: "X",
        rules: {
            'X': { successors: ["F[&X]/[&X]/[&X]", "F[&X]/[&X]"], weights: [0.7, 0.3] }
        },
        iterations: 6,
        params: {
            spread: 34.4, jitter: 5.7,
            length: 6, lengthDecay: 0.7, thickness: 0.8, thicknessDecay: 0.7,
            gravity: 0.0
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'cluster', color: 0x2e8b57, size: 1.0, thickness: 0.3, leaves: 4, leafSize: 0.8 },
    },
    umbrella: { // Stone Pine / Acacia style
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["FFF[&A]/[&A]/[&A]", "FFF[&A]/[&A]/[&A]/[&A]"] },
            // arms, transitions interpreter state
            'A': { successor: "FFF[&cC]/[&cC]" },
            // canopy
            'C': { successor: "F[&C]/[&C]" }
        },
        interpreter: {
            // force branches to the horizontal in the canopy
            'c': { params: { horizonBias: 0.5 } }
        },
        iterations: 6,
        params: {
            spread: 15, jitter: 5,
            length: 2, lengthDecay: 0.9, thickness: 0.6, thicknessDecay: 0.8,
            horizonBias: 0.0
        },
        trunkLengthMultiplier: 2.0,
        leafKind: { kind: 'umbrella', color: 0x1a4a1c, size: 2.0, leaves: 10, leafSize: 0.8 },
    },
    open: { // Japanese Maple / Birch style
        axiom: "FX",
        rules: {
            'X': (i: number) => {
                if (i === 0) return { successors: ["&F/&FX", "/&F/&FX"], weights: [0.5, 0.5] };
                if (i <= 3) return { successors: ["F[&X]/[&X]", "F[&X]"], weights: [0.8, 0.2] };
                return { successors: ["F[&X]/[&FL]", "F[&FL]/[&X]"], weights: [0.5, 0.5] };
            }
        },
        iterations: 6,
        params: {
            spread: 40, jitter: 10,
            length: 1.5, lengthDecay: 0.9, thickness: 0.3, thicknessDecay: 0.7,
            gravity: 0.0
        },
        trunkLengthMultiplier: 1.0,
        leafKind: { kind: 'cluster', color: 0xa03e3e, size: 1.0, thickness: 0.3, leaves: 20, leafSize: 0.6 },
    },
    irregular: { // Monterey Cypress / Gnarled Oak style
        axiom: "X",
        rules: {
            'X': (i: number) => {
                if (i <= 2) return { successors: ["F[&X]", "F/&X", "F[&X]/[&X]"], weights: [0.2, 0.2, 0.6] };
                if (i === 3) return { successor: "F[&X]/[&X]" };
                return { successors: ["F[&X]", "F/&X", "F[&X]/[&X]", "L"], weights: [0.1, 0.1, 0.7, 0.1] };
            }
        },
        iterations: 12,
        params: {
            spread: 40.1, jitter: 28.6,
            length: 2.5, lengthDecay: 0.7, thickness: 0.4, thicknessDecay: 0.7,
            gravity: 0.1
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'cluster', color: 0x2d5a27, size: 1.0, thickness: 0.1, leaves: 4, leafSize: 0.8 },
    },
    vase: {
        axiom: "tT",
        rules: {
            // trunk
            'T': (i: number) => {
                if (i < 1) return { successor: "FFT" };
                return { successor: "vV" };
            },
            // fountain
            'V': (i: number) => {
                if (i < 4) return { successor: "[&V]/[&V]/[&V]/[&V]" };
                return { successor: "B" };
            },
            // branch
            'B': { successors: ["FLFB", "FFLB[&B]/[&B]"] }
        },
        interpreter: {
        },
        iterations: 8,
        params: {
            spread: 25, jitter: 15,
            length: 1, lengthDecay: 0.9, thickness: 0.3, thicknessDecay: 0.8,
            gravity: 0.3
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'blob', color: 0x2d5a27, size: 1.5, thickness: 0.5 },
    }
};
