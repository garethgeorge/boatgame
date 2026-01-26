import * as THREE from 'three';

export interface PlantParams {
    iterations: number;
    length: number;             // base length for branches
    lengthDecay: number;        // length decay factor
    thickness: number;          // base thickness for the trunk
    thicknessDecay: number;     // thickness decay factor (typically 0.5 to 1.0)
}

export interface BranchParams {
    opts?: any;                 // passed through to the branch data

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

    weight?: number;            // weight of the branch segment itself (default 0)
}

export interface LeafParams {
    opts?: any;                 // passed through to the leaf data
    weight?: number;            // weight of the leaf (default 1)
}

export interface BendParams {
    spread?: number;            // angle of sub-branch to branch (degrees)
    jitter?: number;            // jitter for angle to branch
};

export interface RotateParams {
    angle?: number;             // angle of rotation (degrees)
    jitter?: number;            // jitter for angle
};

export interface ExpansionRuleResult {
    successors?: string[];
    successor?: string;    // Convenience for single successor
    weights?: number[];    // their weights (probabilities)
}

export type ExpansionRuleDefinition = ExpansionRuleResult | ((val: number) => ExpansionRuleResult);
export type BranchRuleDefinition = BranchParams | ((val: number) => BranchParams);
export type LeafRuleDefinition = LeafParams;

/**
 * Defines the rules for generating a plant. There are two steps:
 * 1) Generate a string using a set of simple grammar substitution rules.
 * 2) Interpret the string as a set of instructions to a 3d turtle graphics system.
 * 
 * Some characters have built-in meanings in the result string. All others are
 * non-terminal symbols. The built ins are:
 * 
 * ^ - point the turtle upright
 * & - bend out from the current axis
 * / - rotate facing direction around current axis
 * [ - push the current state onto a stack
 * ] - pop the current state from the stack
 * 
 * Additional terminal symbols can be defined in three ways.
 * 
 * The symbols parameter allows a turtle function to be explicitly defined
 * for a symbol. This gives great flexibility. In fact it can be used entirely
 * in place of the grammar substition. For example with axiom 'F' we can
 * define a symbol plant with two branches and a leaf:
 *  symbols: {
 *      'F': (turtle: Turtle) => {
 *          turtle.branch({ spread: 20 }).bend().branch().leaf({opts: { kind: 'leaf' }});
 *      }
 * }
 * 
 * There are no built-in branches. They must be defined via symbols or in the
 * branches parameter.
 *  branches: {
 *      // defines = to add a branch and set the angle for & to 20 degrees
 *      '=': { spread: 20, },
 *      // defines - to add a branch and set the angle for & to 10 degrees
 *      '-': { spread: 10, }
 *  },
 *
 * Leaf symbols can be defined in the leaves parameter. If any leaf symbols
 *  are defined the default + symbol is not automatically
 * defined. Exammple:
 *  leaves: {
 *      // defines * to add a leaf
 *      '*': { opts: { kind; 'center' }}
 *  }
 * 
 * Once a plant structure has been generated via the turtle graphics additional
 * passes fine tune it. This includes:
 * - Calculating branch radii based on the weight of the branches and leaves it
 *   supports. By default each leaf counts as a weight of 1 and branches as 0
 *   but custom values can be given for non-homogeneous plant structures (e.g.
 *   a flower petal has less weight than a true leaf).
 */
export interface PlantConfig {
    // starting string
    axiom: string;
    // grammar substitution rules
    rules?: Record<string, ExpansionRuleDefinition>;
    // final substitution applied to all non-terminals
    finalRule?: string;
    // maps terminal symbols to turtle functions
    symbols?: Record<string, (turtle: Turtle) => void>;
    // maps branch terminal symbols to parameters
    branches?: Record<string, BranchRuleDefinition>;
    // maps leaf terminal symbols to parameters
    leaves?: Record<string, LeafParams>;

    // parameters for the plant
    params: PlantParams;
    defaults: {
        // default parameters for branches
        branch: BranchParams;
    }
}

export interface BranchData {
    start: THREE.Vector3;
    end: THREE.Vector3;
    radiusStart: number;
    radiusEnd: number;
    level: number;
    opts?: any;
}

export interface LeafData {
    pos: THREE.Vector3;
    dir: THREE.Vector3;
    quat: THREE.Quaternion;
    opts?: any;
}

class PlantNode {
    children: PlantNode[] = [];
    leaves: LeafData[] = [];
    leafWeightSum: number = 0;   // Sum of weights of leaves attached directly to this node
    branchWeight: number = 0;    // Weight of the branch segment leading to this node
    load: number = 0;            // The total "Pipe" value (sum of leaves and branch weights above)
    radius: number = 0;          // Calculated in Pass 2

    constructor(
        public position: THREE.Vector3,
        public level: number,
        public opts?: any
    ) { }
}

interface TurtleState {
    pos: THREE.Vector3;
    quat: THREE.Quaternion;
    branch: Required<BranchParams>;
    node: PlantNode;
}

export class Turtle {
    // overall plant parameters
    private plantParams: PlantParams;
    // default parameters for branches
    private defaultBranch: Required<BranchParams>;
    // stack of saved states
    private stack: TurtleState[] = [];
    // current state
    private state: TurtleState;
    private logging: boolean = false;

    constructor(
        root: PlantNode,
        plantParams: PlantParams,
        defaultBranch: Required<BranchParams>
    ) {
        this.plantParams = plantParams;
        this.defaultBranch = defaultBranch;
        this.state = {
            pos: new THREE.Vector3(0, 0, 0),
            quat: new THREE.Quaternion(),
            branch: this.defaultBranch,
            node: root
        };
    }

    public enableLogging() {
        this.logging = true;
    }

    /**
     * Adds a branch. The parameters for the branch are set to the defaults
     * plus any overrides in the given params.
     */
    public branch(params: BranchRuleDefinition = {}): Turtle {
        if (this.logging) console.log('branch');
        this.state.branch = { ...this.defaultBranch, ...params };

        const lengthScale = Math.pow(this.plantParams.lengthDecay, this.stack.length);
        const length = this.plantParams.length * this.state.branch.scale * lengthScale;

        // A. Apply physical forces
        this.state.quat = this.applyPlantForces(
            this.state.quat, this.state.pos, this.state.branch, this.stack.length);

        // This is a pseudo-branch used to set parameters but having no length
        if (length <= 0) {
            return this;
        }

        // B. Calculate end point
        const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(this.state.quat);
        const endPos = this.state.pos.clone().add(dir.multiplyScalar(length));

        // C. Create Graph Node
        const newNode = new PlantNode(endPos, this.stack.length, this.state.branch.opts);
        newNode.branchWeight = this.state.branch.weight ?? 0.0;
        this.state.node.children.push(newNode);

        // D. Move turtle
        this.state.node = newNode; // Move logical turtle
        this.state.pos.copy(endPos); // Move physical turtle

        return this;
    }

    /** Adds a leaf
     */
    public leaf(params: LeafParams = {}): Turtle {
        if (this.logging) console.log('leaf');
        // This node supports a leaf
        const weight = params.weight ?? 1.0;
        this.state.node.leafWeightSum += weight;

        // Also store the visual leaf data for final rendering
        const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(this.state.quat);
        this.state.node.leaves.push({
            pos: this.state.pos.clone(),
            dir: dir,
            quat: this.state.quat.clone(),
            opts: params?.opts
        });

        return this;
    }

    /** 
     * Resets the turtle to point upwards (0,1,0), perturbed by jitter.
     */
    public up(): Turtle {
        if (this.logging) console.log('up');
        this.state.quat.set(0, 0, 0, 1); // Identity points UP in our coordinate system

        const jitter = this.state.branch.jitter || 0;
        if (jitter > 0) {
            const jitterRad = THREE.MathUtils.degToRad(jitter);
            const randomQuat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    (Math.random() - 0.5) * jitterRad,
                    (Math.random() - 0.5) * jitterRad,
                    (Math.random() - 0.5) * jitterRad
                )
            );
            this.state.quat.multiply(randomQuat);
        }

        return this;
    }

    public push(): Turtle {
        if (this.logging) console.log('push');
        this.stack.push({
            pos: this.state.pos.clone(),
            quat: this.state.quat.clone(),
            branch: { ...this.state.branch },
            node: this.state.node // Save junction point in graph
        });
        return this;
    }

    public pop(): Turtle {
        if (this.logging) console.log('pop');
        const prev = this.stack.pop();
        if (prev) {
            this.state.pos.copy(prev.pos);
            this.state.quat.copy(prev.quat);
            this.state.branch = { ...prev.branch };
            this.state.node = prev.node; // Return to junction point
        }
        return this;
    }

    public bend(params: BendParams = {}): Turtle {
        if (this.logging) console.log('bend');
        const spread = params.spread ?? (this.state.branch.spread ?? 0);
        const jitter = params.jitter ?? (this.state.branch.jitter ?? 0);
        const pitchAngle = THREE.MathUtils.degToRad(spread + (Math.random() - 0.5) * jitter);
        const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchAngle);
        this.state.quat.multiply(pitch);
        return this;
    }

    public rotate(params: RotateParams = {}): Turtle {
        if (this.logging) console.log('rotate');
        const goldenAngle = 137.5;
        const angle = params.angle ?? goldenAngle;
        const jitter = params.jitter ?? (this.state.branch.jitter ?? 0);
        const yawAngle = THREE.MathUtils.degToRad(angle + (Math.random() - 0.5) * jitter);
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
        this.state.quat.multiply(yaw);
        return this;
    }

    private applyPlantForces(
        currentQuat: THREE.Quaternion,
        currentPos: THREE.Vector3,
        forces: BranchParams,
        level: number
    ) {
        const currentDir = new THREE.Vector3(0, 1, 0).applyQuaternion(currentQuat);

        // 1. FLEXIBILITY CURVE
        // level 0 = 1.0 (stiff). Higher levels increase flexibility exponentially.
        // 1.15 is a "stiffness" constant; higher = floppier twigs.
        const flexibility = Math.pow(1.15, level);

        // --- FORCE A: GRAVITY (Highly dependent on flexibility) ---
        if (forces.gravity !== 0) {
            const targetVec = new THREE.Vector3(0, forces.gravity > 0 ? -1 : 1, 0);
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetVec);

            // The further from the trunk, the more gravity wins
            const strength = Math.min(0.95, Math.abs(forces.gravity) * flexibility);
            currentQuat.slerp(targetQuat, strength);
        }

        // --- FORCE B: WIND (Highly dependent on flexibility) ---
        if (forces.windForce > 0 && forces.wind.lengthSq() > 0) {
            const windDir = forces.wind.clone().normalize();
            const windQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), windDir);

            // Wind affects thin branches much more than thick trunks
            const strength = Math.min(0.8, forces.windForce * flexibility);
            currentQuat.slerp(windQuat, strength);
        }

        // --- FORCE C: HELIOTROPISM (Seeking light) ---
        if (forces.heliotropism !== 0) {
            const skyQuat = new THREE.Quaternion(); // Identity = Up [0,1,0]

            // Young shoots (high level) are more phototropic than old wood
            const strength = Math.min(0.5, forces.heliotropism * flexibility);
            currentQuat.slerp(skyQuat, strength);
        }

        // --- FORCE D: HORIZON BIAS (Growth Strategy) ---
        // Note: We don't multiply by flexibility here because this is an 
        // architectural "intent" of the plant stage (T, A, C), not a physical sag.
        if (forces.horizonBias !== 0) {
            const targetDir = forces.horizonBias > 0
                ? new THREE.Vector3(currentDir.x, 0, currentDir.z).normalize()
                : new THREE.Vector3(0, 1, 0);

            if (targetDir.lengthSq() > 0) {
                const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetDir);
                currentQuat.slerp(targetQuat, Math.abs(forces.horizonBias));
            }
        }

        // --- FORCE E: ANTI-SHADOWING (Growth Strategy) ---
        if (forces.antiShadow !== 0) {
            const awayFromCenter = new THREE.Vector3(currentPos.x, 0, currentPos.z).normalize();
            if (awayFromCenter.lengthSq() > 0) {
                const shadowQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), awayFromCenter);
                currentQuat.slerp(shadowQuat, forces.antiShadow);
            }
        }

        return currentQuat;
    }
};

/**
 * L-SYSTEM 3D PLANT GENERATION LOGIC
 */
export class ProceduralPlant {
    branches: BranchData[] = [];
    leaves: LeafData[] = [];

    generate(config: PlantConfig) {
        this.branches = [];
        this.leaves = [];

        // If there are no rules just interpret the axiom string
        if (config.rules === undefined) {
            this.interpret(config.axiom, config);
            return;
        }

        let current = config.axiom;

        for (let i = 0; i < config.params.iterations; i++) {
            const isLast = i === config.params.iterations - 1;
            let next = "";
            for (const symbol of current) {
                const rule = config.rules[symbol];

                if (!rule) {
                    next += symbol;
                    continue;
                } else if (isLast) {
                    next += (config.finalRule || "+");
                    continue;
                }

                const result = typeof rule === 'function' ? rule(i) : rule;

                let successor = "";
                if (result.successor) {
                    successor = result.successor;
                } else if (result.successors) {
                    const weights = result.weights || new Array(result.successors.length).fill(1);
                    const totalWeight = weights.reduce((a, b) => a + b, 0);
                    const roll = Math.random() * totalWeight;
                    let acc = 0;
                    for (let j = 0; j < result.successors.length; j++) {
                        acc += weights[j];
                        if (roll < acc) {
                            successor = result.successors[j];
                            break;
                        }
                    }
                }
                next += successor;
            }
            current = next;
        }

        this.interpret(current, config);
    }

    private interpret(instructions: string, config: PlantConfig) {

        // Default parameters for all branches
        const defaultBranch: Required<BranchParams> = {
            opts: undefined,

            spread: 45,
            jitter: 5,
            scale: 1.0,

            gravity: 0.0,
            horizonBias: 0.0,
            heliotropism: 0.0,
            wind: new THREE.Vector3(0, 0, 0),
            windForce: 0,
            antiShadow: 0.0,
            weight: 0.0,

            ...config.defaults.branch
        };

        // get branch and leaf rules
        const branchRules = config.branches;
        const leafRules = config.leaves;

        // get symbol rules
        const leafSymbol = config.leaves != undefined ? {} : {
            '+': (turtle: Turtle) => turtle.leaf()
        };
        const defaultSymbols = {
            '^': (turtle: Turtle) => turtle.up(),
            '[': (turtle: Turtle) => turtle.push(),
            ']': (turtle: Turtle) => turtle.pop(),
            '&': (turtle: Turtle) => turtle.bend(),
            '/': (turtle: Turtle) => turtle.rotate(),
        };
        const symbolRules = {
            ...defaultSymbols,
            ...leafSymbol,
            ...config.symbols
        };

        // --- PASS 1: BUILD TOPOLOGY ---

        const root = new PlantNode(new THREE.Vector3(0, 0, 0), 0);
        const turtle = new Turtle(root, config.params, defaultBranch);

        for (const symbol of instructions) {

            // first try for a symbol function
            const rule = symbolRules[symbol];
            if (rule) {
                rule(turtle);
                continue;
            }

            // perhaps its a branch?
            const branchParams = branchRules?.[symbol];
            if (branchParams) {
                turtle.branch(branchParams);
                continue;
            }

            // perhaps its a leaf?
            const leafRule = leafRules?.[symbol];
            if (leafRule) {
                turtle.leaf(leafRule);
                continue;
            }
        }

        // --- PASS 2: CALCULATE RADII (Back-Propagation) ---

        // 2a. Calculate Load (Weighted Sums)
        const calculateLoad = (node: PlantNode): number => {
            let totalLoad = node.leafWeightSum;
            for (let child of node.children) {
                totalLoad += calculateLoad(child) + child.branchWeight;
            }
            node.load = totalLoad;

            // Base Case: Tip with no load gets small value to ensure non-zero radius
            if (node.load === 0) node.load = 0.5;
            return node.load;
        };
        calculateLoad(root);

        // 2b. Apply Radii (Area Preservation)
        const trunkThickness = config.params.thickness || 1.0;
        const power = config.params.thicknessDecay || 0.5;
        const rootLoad = root.load;
        const scaler = rootLoad > 0 ? trunkThickness / Math.pow(rootLoad, power) : trunkThickness;

        const applyRadii = (node: PlantNode) => {
            node.radius = scaler * Math.pow(node.load, power);
            for (let child of node.children) {
                applyRadii(child);
            }
        };
        applyRadii(root);


        // --- PASS 3: LENGTH ADJUSTMENT (Vigor) ---
        const shiftSubtree = (node: PlantNode, offset: THREE.Vector3) => {
            // Move node's leaves
            for (const leaf of node.leaves) {
                leaf.pos.add(offset);
            }
            // Move children and their subtrees
            for (const child of node.children) {
                child.position.add(offset);
                shiftSubtree(child, offset);
            }
        };

        const adjustNodesForLength = (node: PlantNode) => {
            for (let child of node.children) {
                // 1. Calculate relative vigor [0..1]
                const vigor = node.load > 0 ? (child.load + child.branchWeight) / node.load : 0;

                // 2. Determine new length
                const currentVec = new THREE.Vector3().subVectors(child.position, node.position);
                const currentLen = currentVec.length();

                const minLen = currentLen * 0.2;
                const maxLen = currentLen * 1.2;

                const stretch = Math.pow(vigor, 0.5);
                const newLen = minLen + (maxLen - minLen) * stretch;

                // 3. Move child
                const direction = currentVec.normalize();
                const newPos = node.position.clone().add(direction.multiplyScalar(newLen));

                const offset = new THREE.Vector3().subVectors(newPos, child.position);
                child.position.copy(newPos);

                // 4. Shift Descendants
                shiftSubtree(child, offset);

                // 5. Recurse
                adjustNodesForLength(child);
            }
        }
        adjustNodesForLength(root);


        // --- PASS 4: GEOMETRY AND LEAF COLLECTION ---
        const generateBranchList = (node: PlantNode) => {
            // Collect leaves on this node
            for (const leaf of node.leaves) {
                this.leaves.push(leaf);
            }

            // Collect branches to children
            for (let child of node.children) {
                this.branches.push({
                    start: node.position.clone(),
                    end: child.position.clone(),
                    radiusStart: node.radius,
                    radiusEnd: child.radius,
                    level: child.level,
                    opts: child.opts
                });
                generateBranchList(child);
            }
        };
        generateBranchList(root);
    }
}
