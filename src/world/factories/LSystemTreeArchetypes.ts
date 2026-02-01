import * as THREE from 'three';
import { PlantConfig } from './LSystemPlantGenerator';
import { LeafKindParams } from './LSystemPartParams';
import { Turtle } from './LSystemPlantGenerator';

export type LSystemTreeKind = 'willow' | 'poplar' | 'oak' | 'elm' |
    'umbrella' | 'open' | 'irregular' | 'vase' | 'birch' | 'elder' |
    'palm';

export interface TreeVisuals {
    leafKind: LeafKindParams;
    leafColor?: number;
    woodColor?: number;
}

export interface TreeConfig extends PlantConfig {
    visuals: TreeVisuals;
};

export const ARCHETYPES: Record<LSystemTreeKind, TreeConfig> = {
    willow: {
        visuals: {
            leafKind: {
                kind: 'willow',
                strands: 3,
                variation: { h: 0.05, s: 0.1, l: 0.1 }
            },
            leafColor: 0x41b98d,
            woodColor: 0x4b3621
        },
        axiom: "#C",
        rules: {
            // crown section
            'C': { successor: "[&&=D]/[&&=D]/[&&=D]" },
            'D': { successor: "[&&=W]/[&&=W]/[&&=W]" },
            // weeping
            'W': { successors: ["--W", "E"], weights: [0.7, 0.3] },
            // final branches
            'E': { successors: ["[&--+]/[&--+]/[&--+]", "[&--+]/[&--+]/[&--+]"] },
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
        },
        defaults: {
            branch: {
                spread: 22.9, jitter: 7, gravity: 0.0
            },
        }
    },

    poplar: {
        visuals: {
            leafKind: {
                kind: 'blob',
                size: 1.0,
                thickness: 2.5,
                variation: { h: 0.02, s: 0.05, l: 0.1 }
            },
            leafColor: 0x3ea043,
            woodColor: 0x4b3621
        },
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
        },
        defaults: {
            branch: {
                spread: 15.0, jitter: 5.0, gravity: -0.15
            },
        }
    },

    oak: {
        visuals: {
            leafKind: {
                kind: 'blob',
                size: 1.0,
                thickness: 0.6,
                variation: { h: 0.03, s: 0.1, l: 0.15 }
            },
            leafColor: 0x228B22,
            woodColor: 0x4b3621
        },
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
        },
        defaults: {
            branch: {
                spread: 63.0, jitter: 17.2,
            },
        },
    },

    elm: {
        visuals: {
            leafKind: {
                kind: 'cluster',
                size: 2.0,
                thickness: 0.3,
                leaves: 20,
                leafSize: 0.5,
                variation: { h: 0.05, s: 0.15, l: 0.2 }
            },
            leafColor: 0x2e8b57,
            woodColor: 0x4b3621
        },
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
        },
        defaults: {
            branch: {
                spread: 30, jitter: 5, gravity: 0.0
            },
        }
    },

    umbrella: { // Stone Pine / Acacia style
        visuals: {
            leafKind: {
                kind: 'umbrella',
                size: 2.0,
                leaves: 10,
                leafSize: 0.8,
                variation: { h: 0.02, s: 0.05, l: 0.05 }
            },
            leafColor: 0x1a4a1c,
            woodColor: 0x4b3621
        },
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
        },
        defaults: {
            branch: {
                spread: 15, jitter: 5, horizonBias: 0.0
            },
        }
    },

    open: { // Japanese Maple / Birch style
        visuals: {
            leafKind: {
                kind: 'cluster',
                size: 1.0,
                thickness: 0.3,
                leaves: 20,
                leafSize: 0.6,
                variation: { h: 0.08, s: 0.2, l: 0.1 }
            },
            leafColor: 0xa03e3e,
            woodColor: 0x4b3621
        },
        axiom: "=X",
        rules: {
            'X': (i: number, n: number) => {
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
        },
        defaults: {
            branch: {
                spread: 40, jitter: 10, gravity: 0.0
            },
        }
    },

    irregular: { // Monterey Cypress / Gnarled Oak style
        visuals: {
            leafKind: {
                kind: 'blob',
                size: 1.0,
                thickness: 0.3,
                variation: { h: 0.05, s: 0.1, l: 0.1 }
            },
            leafColor: 0x228B22,
            woodColor: 0x4b3621
        },
        axiom: "X",
        rules: {
            'X': (level: number, count: number) => {
                if (level < 2) return { successor: "##[&X][X]" };
                if (level < 3) return { successor: "===[&&X]/[&&X]" };
                if (level < 4) return { successor: "==[&&X]/[&&X]" };
                return { successor: "--[^+]/[^+]" };
            }
        },
        finalRule: "[^+]",
        branches: {
            '#': { windForce: 0.05 },
            '=': { windForce: 0.1, gravity: 0.05 },
            '-': { windForce: 0.2, heliotropism: 1.0 },
        },
        params: {
            iterations: 12,
            length: 1.0, lengthDecay: 0.9,
            thickness: 0.3, thicknessDecay: 0.6,
        },
        defaults: {
            branch: {
                spread: 30, jitter: 10, wind: new THREE.Vector3(-0.6, 0.1, 0)
            },
        }
    },

    vase: {
        visuals: {
            leafKind: {
                kind: 'blob',
                size: 1.0,
                thickness: 0.5,
                variation: { h: 0.03, s: 0.05, l: 0.1 }
            },
            leafColor: 0x2d5a27,
            woodColor: 0x4b3621
        },
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
        },
        defaults: {
            branch: {
                spread: 45, jitter: 5,
            },
        }
    },

    elder: {
        // "Mother of the Forest" - Ancient, massive, and distinct
        visuals: {
            leafKind: {
                kind: 'blob',
                size: 4.5,
                thickness: 0.4,
                variation: { h: 0.04, s: 0.1, l: 0.1 }
            },
            leafColor: 0x2d5a27, // Lush forest green
            woodColor: 0x4a2511 // Rich Mahogany
        },
        axiom: "T",
        rules: {
            // Twisted trunk
            'T': { successors: ["###[&C]/[&C]/[&C]"] },

            // Massive crown
            'C': (i: number) => {
                if (i < 3) return { successors: ["=[&C]/[&C]", "=[&C]/[&C]"], weights: [0.6, 0.4] };
                return { successor: "B" };
            },

            // Gnarly branches
            'B': { successors: ["==[&B]/[&B]", "+[&B]"], weights: [0.7, 0.3] }
        },
        finalRule: "[.^+]", // Use ^+ for upright leaves

        branches: {
            '#': {},
            '=': {},

            // Pseudo branch for attaching leaves
            '.': { scale: 0, jitter: 5 },
        },
        params: {
            iterations: 9, // One more iteration for the extra size
            length: 10.0, lengthDecay: 0.82, // Significantly longer base
            thickness: 6.0, thicknessDecay: 0.6, // Massive trunk
        },
        defaults: {
            branch: {
                spread: 75.0, jitter: 25.0, gravity: -0.05, heliotropism: 0.15
            },
        }
    },

    birch: {
        // Based on Oak, but with adjustments for a birch feel
        visuals: {
            leafKind: {
                kind: 'blob',
                size: 1.0,
                thickness: 0.6,
                variation: { h: 0.03, s: 0.1, l: 0.1 }
            }, // Light green leaves
            leafColor: 0x86bf5e,
            woodColor: 0xe3e3e3 // White/Pale trunk
        },
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
        },
        defaults: {
            branch: {
                spread: 50.0, jitter: 15.0
            },
        },
    },
    palm: {
        visuals: {
            leafKind: {
                kind: "blob",
                size: 1,
                thickness: 1,
            },
            leafColor: 0x4a7a2a,
            woodColor: 0x736D45
        },
        axiom: "T",
        rules: {
            // base of trunk, has a bend at the bottom
            T: { successors: ["#==U{4}", "#==U{3}", "#==U{2}"] },
            // trunk, heliotropism to straighten up
            U: (level: number, count: number) => {
                if (count > 0) return { successor: "[=U{-}]" };
                return { successor: "C" };
            },
        },
        symbols: {
            "#": (turtle) => {
                turtle.bend({ spread: 30, jitter: 15 });
                turtle.branch({ scale: 0.5 });
            },
            "=": (turtle) => {
                turtle.branch({ scale: 0.5, heliotropism: 0.2 });
            },
            "C": (turtle) => {
                const w0 = 4;
                const w1 = 30;
                for (let l = 0; l < 3; l++) {
                    for (let j = 0; j < 5 + l; j++) {
                        turtle.rotate();
                        turtle.push();
                        turtle.bend({ spread: 20 + 20 * l });
                        turtle.branch({ scale: 0.1 });
                        for (let i = 0; i <= 2 + l; i++) {
                            const t = i / (2 + l);
                            const u = t < 0.5 ? t * 2 : (1 - t) * 2;
                            const w = w0 + (w1 - w0) * u;
                            turtle.rotate({ angle: 0, jitter: 20 });
                            turtle.branch({
                                gravity: 0.15, scale: 0.5, geomIndex: 1,
                                opts: {
                                    kind: 'rectangle', widthScale: [w, w],
                                    variation: { h: 0.05, s: 0.1, l: 0.1 }
                                }
                            });
                        }
                        turtle.pop();
                    }
                }
            },
        },
        params: {
            iterations: 10,
            length: 3,
            lengthDecay: 0.8,
            thickness: 0.3,
            thicknessDecay: 1.0,
            taperRate: 0.015
        }
    }
};

