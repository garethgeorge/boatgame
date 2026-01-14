import * as THREE from 'three';

export type LSystemTreeKind = 'willow' | 'poplar' | 'oak' | 'elm' |
    'umbrella' | 'open' | 'irregular' | 'vase' | 'birch' | 'elder';

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
    iterations: number;
    length: number;             // base length for branches
    lengthDecay: number;        // length decay factor
    thickness: number;          // base thickness for the trunk
    thicknessDecay: number;     // thickness decay factor (typically 0.5 to 1.0)
    leafKind: LeafKindParams;
    trunkColor?: number;        // Optional override for trunk color
}

export interface BranchParams {
    spread?: number;            // default angle of sub-branch to branch (degrees)
    jitter?: number;            // jitter for angle to branch and angle around branch (degrees)
    scale?: number;             // scales branch length

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

export type BranchRuleDefinition = BranchParams | ((val: number) => BranchParams);

export interface TreeConfig {
    // starting string
    axiom: string;
    // grammar substitution rules
    rules: Record<string, ExpansionRuleDefinition>;
    // final substitution applied to all non-terminals
    finalRule?: string;
    // maps branch terminal symbols to parameters
    branches: Record<string, BranchRuleDefinition>;

    // parameters for the tree
    params: TreeParams;
    defaults: {
        // default parameters for branches
        branch: BranchParams;
    }
}

export const ARCHETYPES: Record<LSystemTreeKind, TreeConfig> = {
    willow: {
        axiom: "#C",
        rules: {
            // crown section
            'C': { successor: "[&&=D]/[&&=D]/[&&=D]" },
            'D': { successor: "[&&=W]/[&&=W]/[&&=W]" },
            // weeping
            'W': { successors: ["--W", "E"], weights: [0.7, 0.3] },
            // final branches
            'E': { successors: ["[&--+]/[&--+]/[&--+]", "[&--+]/[&--+]/[&--+]/[&--+]"] },
        },
        branches: {
            '#': { scale: 1.5 },
            '=': {},
            // turn on gravity for weeping
            '-': { scale: 0.3, gravity: 0.25 }
        },
        params: {
            iterations: 5,
            length: 3, lengthDecay: 0.85,
            thickness: 0.5, thicknessDecay: 0.7,
            leafKind: { kind: 'willow', color: 0x41b98d, strands: 3 },
        },
        defaults: {
            branch: {
                spread: 22.9, jitter: 7, gravity: 0.0
            },
        }
    },

    poplar: {
        axiom: "##X",
        rules: {
            'X': { successors: ["[&B]==[/X]", "=+"], weights: [0.95, 0.05] },
            'B': { successors: ["=+", "=B"], weights: [0.7, 0.3] }
        },
        branches: {
            '#': {},
            '=': {},
        },
        params: {
            iterations: 7,
            length: 2, lengthDecay: 0.8,
            thickness: 0.3, thicknessDecay: 0.7,
            leafKind: { kind: 'blob', color: 0x3ea043, size: 1.0, thickness: 2.5 },
        },
        defaults: {
            branch: {
                spread: 15.0, jitter: 5.0, gravity: -0.15
            },
        }
    },

    oak: {
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["##[&C]/[&C]/[&C]"] },
            // crown branching
            'C': (i: number) => {
                if (i < 2) return { successors: ["=[&C]/[&C]", "=[&C]/[&C]/[&C]"], weights: [0.5, 0.5] };
                return { successor: "B" };
            },
            // final branching
            'B': { successors: ["=[&B]/[&B]", "=[&B]/[&B]/[&B]", "+"], weights: [0.4, 0.4, 0.2] }
        },
        branches: {
            '#': {},
            '=': { gravity: 0.05 },
        },
        params: {
            iterations: 7,
            length: 4, lengthDecay: 0.8,
            thickness: 0.7, thicknessDecay: 0.7,
            leafKind: { kind: 'blob', color: 0x228B22, size: 1.0, thickness: 0.6 },
        },
        defaults: {
            branch: {
                spread: 63.0, jitter: 17.2,
            },
        }
    },

    elm: {
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["####[F]U", "###[F]###[G]U"] },
            // fountain bursts
            'F': { successor: "[&A]/[&A]/[&A]/[&A]/[&A]" },
            'G': { successor: "[&A]/[&A]/[&A]" },
            // long arching stems affected by gravity
            'A': { successor: "=====B" },
            // long upright stem
            'U': { successor: "----B" },
            // terminal branches affected by gravity
            'B': { successors: ["[&==+]/[&==+]", "[&==+]/[&==+]/[&==+]"] }
        },
        branches: {
            '#': {},
            '=': { gravity: 0.06 },
            '-': {},
        },
        params: {
            iterations: 10,
            length: 1, lengthDecay: 1,
            thickness: 0.6, thicknessDecay: 0.5,
            leafKind: { kind: 'cluster', color: 0x2e8b57, size: 2.0, thickness: 0.3, leaves: 20, leafSize: 0.5 },
        },
        defaults: {
            branch: {
                spread: 30, jitter: 5, gravity: 0.0
            },
        }
    },

    umbrella: { // Stone Pine / Acacia style
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["###[&A]/[&A]/[&A]", "###[&A]/[&A]/[&A]/[&A]"] },
            // arms
            'A': { successor: "===[&C]/[&C]" },
            // canopy, has horizon bias
            'C': { successor: "-[&C]/[&C]" }
        },
        branches: {
            '#': { scale: 2.0 },
            '=': {},
            '-': { horizonBias: 0.5 },
        },
        params: {
            iterations: 6,
            length: 2, lengthDecay: 0.9,
            thickness: 0.5, thicknessDecay: 0.6,
            leafKind: { kind: 'umbrella', color: 0x1a4a1c, size: 2.0, leaves: 10, leafSize: 0.8 },
        },
        defaults: {
            branch: {
                spread: 15, jitter: 5, horizonBias: 0.0
            },
        }
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
        branches: {
            '=': {},
        },
        params: {
            iterations: 6,
            length: 1.5, lengthDecay: 0.9,
            thickness: 0.2, thicknessDecay: 0.5,
            leafKind: { kind: 'cluster', color: 0xa03e3e, size: 1.0, thickness: 0.3, leaves: 20, leafSize: 0.6 },
        },
        defaults: {
            branch: {
                spread: 40, jitter: 10, gravity: 0.0
            },
        }
    },

    irregular: { // Monterey Cypress / Gnarled Oak style
        axiom: "X",
        rules: {
            'X': (level: number) => {
                if (level < 2) return { successor: "##[&X][X]" };
                if (level < 3) return { successor: "===[&&X]/[&&X]" };
                if (level < 4) return { successor: "==[&&X]/[&&X]" };
                return { successor: "--[&+]/[&+]" };
            }
        },
        branches: {
            '#': { windForce: 0.05 },
            '=': { windForce: 0.1, gravity: 0.05 },
            '-': { windForce: 0.2, heliotropism: 1.0 },
        },
        params: {
            iterations: 12,
            length: 1.0, lengthDecay: 0.9,
            thickness: 0.3, thicknessDecay: 0.6,
            leafKind: { kind: 'blob', color: 0x228B22, size: 1.0, thickness: 0.3 },
        },
        defaults: {
            branch: {
                spread: 30, jitter: 10, wind: new THREE.Vector3(-0.6, 0.1, 0)
            },
        }
    },

    vase: {
        axiom: "T",
        rules: {
            // trunk, has a bend then forced more upright
            'T': { successor: "#&##@V" },
            // fountain
            'V': { successor: "[&W]/[&W]/[&W]" },
            'W': { successors: ["==+=+[&B]/[&B]/[&B]", "=+==+[&B]/[&B]"], weights: [0.5, 0.5] },
            // branch
            'B': { successors: ["L", "[&L]/[&L]"] },
            // leaf
            'L': { successor: "===+" }
        },
        branches: {
            '#': { spread: 10, jitter: 5 },
            '@': { heliotropism: 0.9 },
            '=': { heliotropism: 0.2 },
        },
        params: {
            iterations: 8,
            length: 0.75, lengthDecay: 0.9,
            thickness: 0.3, thicknessDecay: 0.5,
            leafKind: { kind: 'blob', color: 0x2d5a27, size: 1.0, thickness: 0.5 },
        },
        defaults: {
            branch: {
                spread: 45, jitter: 5,
            },
        }
    },

    elder: {
        // "Mother of the Forest" - Ancient, massive, and distinct
        axiom: "T",
        rules: {
            // twisted trunk
            'T': { successors: ["###[&C]/[&C]/[&C]"] },
            // massive crown
            'C': (i: number) => {
                if (i < 3) return { successors: ["=[&C]/[&C]", "=[&C]/[&C]"], weights: [0.6, 0.4] };
                return { successor: "B" };
            },
            // gnarly branches
            'B': { successors: ["==[&B]/[&B]", "+[&B]"], weights: [0.7, 0.3] }
        },
        finalRule: "$", // Use $ as final production rule for upward leaves 

        branches: {
            '#': { gravity: 0.02 },
            '=': {},
        },
        params: {
            iterations: 8, // More iterations for detail
            length: 8.0, lengthDecay: 0.85, // Huge starting length
            thickness: 3.0, thicknessDecay: 0.6, // Massive trunk
            leafKind: { kind: 'blob', color: 0x1d3618, size: 3.5, thickness: 0.4 }, // Flattened horizontal pads
            trunkColor: 0x3d3226 // Ancient dark wood
        },
        defaults: {
            branch: {
                spread: 60.0, jitter: 25.0, gravity: 0.15
            },
        }
    },

    birch: {
        // Based on Oak, but with adjustments for a birch feel
        axiom: "T",
        rules: {
            // trunk
            'T': { successors: ["##[&C]/[&C]/[&C]"] },
            // crown branching
            'C': (i: number) => {
                if (i < 2) return { successors: ["=[&C]/[&C]", "=[&C]/[&C]/[&C]"], weights: [0.5, 0.5] };
                return { successor: "B" };
            },
            // final branching
            'B': { successors: ["=[&B]/[&B]", "=[&B]/[&B]/[&B]", "+"], weights: [0.4, 0.4, 0.2] }
        },

        branches: {
            '#': { scale: 1.2, gravity: 0.05 },
            '=': { gravity: 0.05 },
        },
        params: {
            iterations: 7,
            length: 3.5, lengthDecay: 0.85,
            thickness: 0.6, thicknessDecay: 0.7, // Slightly thinner than oak
            leafKind: { kind: 'blob', color: 0x86bf5e, size: 1.0, thickness: 0.6 }, // Light green leaves
            trunkColor: 0xe3e3e3 // White/Pale trunk
        },
        defaults: {
            branch: {
                spread: 50.0, jitter: 15.0
            },
        }
    }
};

