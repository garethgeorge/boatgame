import * as THREE from 'three';

export type LSystemTreeKind = 'willow' | 'poplar' | 'oak' | 'elm' |
    'umbrella' | 'open' | 'irregular' | 'vase';

export type LeafKind = 'blob' | 'willow' | 'irregular' | 'cluster' | 'umbrella';
export interface BlobLeafKindParams {
    kind: 'blob'; color: number; size: number; thickness: number;
}
export interface WillowLeafKindParams {
    kind: 'willow'; color: number; strands: number;
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
    spread?: number;            // default angle of branch to parent (degrees)
    jitter?: number;            // jitter for angle to parent and angle around parent (degrees)
    length?: number;            // base length for branches
    lengthDecay?: number;       // length decay factor
    thickness?: number;         // base thickness for the trunk
    thicknessDecay?: number;    // thickness decay factor (typically 0.5 to 1.0)

    // shaping parameters
    gravity?: number;           // pulls branches to ground or pushes to sky
    horizonBias?: number;       // pull toward or push away from horizon
    heliotropism?: number;
    wind?: THREE.Vector3;       // push branches in wind direction
    windForce?: number;
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
    trunkLengthMultiplier?: number;
    leafKind: LeafKindParams;

    // defaults for per rule parameters
    params: TreeParams;
}

export const ARCHETYPES: Record<LSystemTreeKind, TreeConfig> = {
    willow: {
        axiom: "=cC",
        rules: {
            // crown section
            'C': (i: number) => {
                if (i <= 2) return { successor: "[&&=C]/[&&=C]/[&&=C]" };
                return { successor: "wW" };
            },
            // weeping
            'W': { successors: ["=W", "E"], weights: [0.8, 0.2] },
            // final branches
            'E': { successors: ["[&=+]/[&=+]/[&=+]", "[&=+]/[&=+]/[&=+]/[&=+]"] },
        },
        interpreter: {
            // turn on gravity for weeping
            'w': { params: { gravity: 0.25 } }
        },
        iterations: 5,
        params: {
            spread: 22.9, jitter: 11.5,
            length: 3, lengthDecay: 0.85,
            thickness: 0.5, thicknessDecay: 0.7,
            gravity: 0.0
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'willow', color: 0x41b98d, strands: 3 },
    },

    poplar: {
        axiom: "==X",
        rules: {
            'X': { successors: ["[&B]==[/X]", "=+"], weights: [0.95, 0.05] },
            'B': { successors: ["=+", "=B"], weights: [0.7, 0.3] }
        },
        iterations: 7,
        params: {
            spread: 15.0, jitter: 5.0,
            length: 2, lengthDecay: 0.9, thickness: 0.3, thicknessDecay: 0.7,
            gravity: -0.15
        },
        leafKind: { kind: 'blob', color: 0x3ea043, size: 1.0, thickness: 2.5 },
    },

    oak: {
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["==c[&C]/[&C]/[&C]"] },
            // crown branching
            'C': (i: number) => {
                if (i < 2) return { successors: ["=[&C]/[&C]", "=[&C]/[&C]/[&C]"], weights: [0.5, 0.5] };
                return { successor: "B" };
            },
            // final branching
            'B': { successors: ["=[&B]/[&B]", "=[&B]/[&B]/[&B]", "+"], weights: [0.4, 0.4, 0.2] }
        },
        interpreter: {
            // turn on gravity
            'c': { params: { gravity: 0.05 } }
        },
        iterations: 7,
        params: {
            spread: 63.0, jitter: 17.2,
            length: 4, lengthDecay: 0.8, thickness: 0.7, thicknessDecay: 0.7,
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'blob', color: 0x228B22, size: 1.0, thickness: 0.6 },
    },

    elm: {
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["====c[fF]A", "===[cfF]===[cfG]A"] },
            // fountain bursts
            'F': { successor: "[&A]/[&A]/[&A]/[&A]/[&A]" },
            'G': { successor: "[&A]/[&A]/[&A]" },
            // long arching stems
            'A': { successor: "=====B" },
            // terminal branches
            'B': { successors: ["[&==+]/[&==+]", "[&==+]/[&==+]/[&==+]"] }
        },
        interpreter: {
            // fountain parameters for arching 
            'f': {
                params: {
                    gravity: 0.06//, heliotropism: 0.1
                }
            }
        },
        iterations: 10,
        params: {
            spread: 30, jitter: 5,
            length: 1, lengthDecay: 1, thickness: 0.6, thicknessDecay: 0.5,
            gravity: 0.0
        },
        trunkLengthMultiplier: 1.5,
        leafKind: { kind: 'cluster', color: 0x2e8b57, size: 2.0, thickness: 0.3, leaves: 20, leafSize: 0.5 },
    },

    umbrella: { // Stone Pine / Acacia style
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["===[&A]/[&A]/[&A]", "===[&A]/[&A]/[&A]/[&A]"] },
            // arms, transitions interpreter state
            'A': { successor: "===[&cC]/[&cC]" },
            // canopy
            'C': { successor: "=[&C]/[&C]" }
        },
        interpreter: {
            // force branches to the horizontal in the canopy
            'c': { params: { horizonBias: 0.5 } }
        },
        iterations: 6,
        params: {
            spread: 15, jitter: 5,
            length: 2, lengthDecay: 0.9, thickness: 0.5, thicknessDecay: 0.6,
            horizonBias: 0.0
        },
        trunkLengthMultiplier: 2.0,
        leafKind: { kind: 'umbrella', color: 0x1a4a1c, size: 2.0, leaves: 10, leafSize: 0.8 },
    },

    open: { // Japanese Maple / Birch style
        axiom: "=X",
        rules: {
            'X': (i: number) => {
                if (i === 0) return { successors: ["&=/&=X", "/&=/&=X"], weights: [0.5, 0.5] };
                if (i <= 3) return { successors: ["=[&X]/[&X]", "=[&X]"], weights: [0.8, 0.2] };
                return { successors: ["=[&X]/[&=+]", "=[&=+]/[&X]"], weights: [0.5, 0.5] };
            }
        },
        iterations: 6,
        params: {
            spread: 40, jitter: 10,
            length: 1.5, lengthDecay: 0.9, thickness: 0.2, thicknessDecay: 0.5,
            gravity: 0.0
        },
        trunkLengthMultiplier: 1.0,
        leafKind: { kind: 'cluster', color: 0xa03e3e, size: 1.0, thickness: 0.3, leaves: 20, leafSize: 0.6 },
    },

    irregular: { // Monterey Cypress / Gnarled Oak style
        axiom: "tX",
        rules: {
            'X': (level: number) => {
                if (level < 2) return { successor: "==[&X][X]" };
                if (level < 3) return { successor: "v===[&&X]/[&&X]" };
                if (level < 4) return { successor: "v==[&&X]/[&&X]" };
                return { successor: "c==[&+]/[&+]" };
            }
        },
        interpreter: {
            't': { params: { windForce: 0.05 } },
            'v': { params: { windForce: 0.1, gravity: 0.05 } },
            'c': { params: { windForce: 0.2, heliotropism: 1.0 } },
        },
        iterations: 12,
        params: {
            spread: 30, jitter: 10,
            length: 1.0, lengthDecay: 0.9, thickness: 0.3, thicknessDecay: 0.6,
            wind: new THREE.Vector3(-0.6, 0.1, 0)
        },
        leafKind: { kind: 'blob', color: 0x228B22, size: 1.0, thickness: 0.3 },
    },

    vase: {
        axiom: "T",
        rules: {
            // trunk
            'T': { successor: "====vV" },
            // fountain
            'V': { successor: "[&W]/[&W]/[&W]" },
            'W': { successors: ["+====+[&B]/[&B]/[&B]", "=+==+[&B]/[&B]"], weights: [0.5, 0.5] },
            // branch
            'B': { successors: ["L", "[&L]/[&L]"] },
            // leaf
            'L': { successor: "===+" }
        },
        interpreter: {
            'v': { params: { heliotropism: 0.2 } }
        },
        iterations: 8,
        params: {
            spread: 45, jitter: 5,
            length: 0.75, lengthDecay: 0.9, thickness: 0.3, thicknessDecay: 0.5,
        },
        leafKind: { kind: 'blob', color: 0x2d5a27, size: 1.0, thickness: 0.5 },
    }
};
