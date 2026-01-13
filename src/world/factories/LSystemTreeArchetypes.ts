export type LSystemTreeKind = 'willow' | 'poplar' | 'oak' | 'elm' | 'umbrella' | 'open' | 'irregular';

export type TreeShape = 'default' | 'umbrella';
export interface DefaultTreeShapeParams { gravity: number };
export interface UmbrellaTreeShapeParams { strength: number };
export type TreeShapeParams = DefaultTreeShapeParams | UmbrellaTreeShapeParams;

export type LeafKind = 'blob' | 'willow' | 'irregular' | 'cluster' | 'umbrella';
export interface BlobLeafKindParams {
    color: number; size: number; thickness: number;
}
export interface WillowLeafKindParams {
    color: number
};
export interface IrregularLeafKindParams {
    color: number; size: number; thickness: number;
}
export interface ClusterLeafKindParams {
    color: number; size: number; thickness: number; leaves: number; leafSize: number;
}
export interface UmbrellaLeafKindParams {
    color: number; size: number; leaves: number; leafSize: number;
}
export type LeafKindParams = BlobLeafKindParams | WillowLeafKindParams |
    IrregularLeafKindParams | ClusterLeafKindParams | UmbrellaLeafKindParams;

export interface TreeParams {
    spread?: number;
    jitter?: number;
    lengthDecay?: number;
    thicknessDecay?: number;
}

export interface ExpansionRuleResult {
    successors?: string[];
    successor?: string;    // Convenience for single successor
    weights?: number[];    // their weights (probabilities)
}

export type ExpansionRuleDefinition = ExpansionRuleResult | ((val: number) => ExpansionRuleResult);

export interface InterpreterRuleResult {
    params?: TreeParams;        // parameters that can override defaults
    shape?: TreeShapeParams;    // parameters that override those for the tree shape
}

export type InterpreterRuleDefinition = InterpreterRuleResult | ((val: number) => InterpreterRuleResult);

export interface TreeConfig {
    axiom: string;
    rules: Record<string, ExpansionRuleDefinition>;
    interpreter?: Record<string, InterpreterRuleDefinition>;

    // parameters set only once
    iterations: number;
    branchLength: number;
    trunkLengthMultiplier: number;
    thickness: number;
    leafKind: { name: LeafKind, params: LeafKindParams };
    treeShape: { name: TreeShape, params: TreeShapeParams };

    // defaults for per rule parameters
    params: Required<TreeParams>;
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
        params: { spread: 22.9, jitter: 11.5, lengthDecay: 0.8, thicknessDecay: 0.6 },
        branchLength: 3, trunkLengthMultiplier: 1.5, thickness: 0.7,
        leafKind: { name: 'willow', params: { color: 0x41b98d } },
        treeShape: { name: 'default', params: { gravity: -0.25 } }
    },
    poplar: {
        axiom: "X",
        rules: {
            'X': { successor: "F[&X]/X" }
        },
        iterations: 7,
        params: { spread: 5.7, jitter: 2.9, lengthDecay: 0.75, thicknessDecay: 0.75 },
        branchLength: 2, trunkLengthMultiplier: 1.2, thickness: 0.5,
        leafKind: { name: 'blob', params: { color: 0x3ea043, size: 1.0, thickness: 2.5 } },
        treeShape: { name: 'default', params: { gravity: 0.15 } }
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
        params: { spread: 63.0, jitter: 17.2, lengthDecay: 0.8, thicknessDecay: 0.75 },
        branchLength: 4.0, trunkLengthMultiplier: 1.5, thickness: 0.9,
        leafKind: { name: 'blob', params: { color: 0x228B22, size: 1.8, thickness: 0.6 } },
        treeShape: { name: 'default', params: { gravity: -0.05 } }
    },
    elm: {
        axiom: "X",
        rules: {
            'X': { successors: ["F[&X]/[&X]/[&X]", "F[&X]/[&X]"], weights: [0.7, 0.3] }
        },
        iterations: 6,
        params: { spread: 34.4, jitter: 5.7, lengthDecay: 0.7, thicknessDecay: 0.7 },
        branchLength: 6, trunkLengthMultiplier: 1.5, thickness: 0.8,
        leafKind: { name: 'cluster', params: { color: 0x2e8b57, size: 1.0, thickness: 0.3, leaves: 4, leafSize: 0.8 } },
        treeShape: { name: 'default', params: { gravity: 0.0 } }
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
            'c': { shape: { strength: 0.5 } }
        },
        iterations: 6,
        params: { spread: 15, jitter: 5, lengthDecay: 0.9, thicknessDecay: 0.8 },
        branchLength: 2.0, trunkLengthMultiplier: 2.0, thickness: 0.6,
        leafKind: { name: 'umbrella', params: { color: 0x1a4a1c, size: 2.0, leaves: 10, leafSize: 0.8 } },
        treeShape: { name: 'umbrella', params: { strength: 0.0 } }
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
        params: { spread: 40, jitter: 10, lengthDecay: 0.9, thicknessDecay: 0.7 },
        branchLength: 1.5, trunkLengthMultiplier: 1.0, thickness: 0.3,
        leafKind: { name: 'cluster', params: { color: 0xa03e3e, size: 1.0, thickness: 0.3, leaves: 20, leafSize: 0.6 } },
        treeShape: { name: 'default', params: { gravity: 0.0 } }
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
        params: { spread: 40.1, jitter: 28.6, lengthDecay: 0.7, thicknessDecay: 0.7 },
        branchLength: 2.5, trunkLengthMultiplier: 1.5, thickness: 0.4,
        leafKind: { name: 'cluster', params: { color: 0x2d5a27, size: 1.0, thickness: 0.1, leaves: 4, leafSize: 0.8 } },
        treeShape: { name: 'default', params: { gravity: 0.1 } }
    }
};
