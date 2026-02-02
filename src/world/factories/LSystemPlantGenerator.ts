import * as THREE from 'three';
import { PlantPartParams } from './LSystemPartParams';

export interface PlantParams {
    iterations: number;
    length: number;             // base length for branches
    lengthDecay: number;        // length decay factor
    thickness: number;          // base thickness for the trunk
    thicknessDecay: number;     // thickness decay factor (typically 0.5 to 1.0)
    taperRate?: number;         // radius reduction per unit length
    minTwigRadius?: number;     // minimum radius floor
}

export interface BranchParams {
    opts?: any;                 // passed through to the branch data
    geomIndex?: number;         // 0: primary, 1: secondary, 2: tertiary

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
    geomIndex?: number;         // 0: primary, 1: secondary, 2: tertiary
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

export type ExpansionRuleDefinition = ExpansionRuleResult | ((val: number, count: number) => ExpansionRuleResult);
export type BranchRuleDefinition = BranchParams | ((val: number) => BranchParams);
export type LeafRuleDefinition = LeafParams;

/**
 * Defines the rules for generating a plant. There are two steps:
 * 1) Generate a string using a set of simple grammar substitution rules.
 * 2) Interpret the string as a set of instructions to a 3d turtle graphics system.
 * 
 * The grammar substition rule can either be one of the forms:
 * { successor: 'replacement string' }
 * { successor: ['string1', 'string2' ..], weights: [ p1, p2, ..] }
 * (level: number, count: number) => one of the above
 * 
 * The level parameter to the function is the iteration level.
 * 
 * The L-system string is usually interpreted one character at a time. But
 * a character can be followed by {<number>}. The number is parsed and
 * passed as the count parameter to the rule function. The successor string
 * from the function is also parsed and occurrences of {+} and {-} are replaced
 * with {<count+1} and {count-1} respectively. This provides a way to control
 * the application of recursive rules.
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
    defaults?: {
        // default parameters for branches
        branch?: BranchParams;
    }
}

export interface BranchData {
    start: THREE.Vector3;
    end: THREE.Vector3;
    radiusStart: number;
    radiusEnd: number;
    level: number;
    quat: THREE.Quaternion;
    opts?: PlantPartParams;
    geomIndex: number;

    // Links for seamless joining
    prev?: BranchData;
    next?: BranchData;
}

export interface LeafData {
    pos: THREE.Vector3;
    dir: THREE.Vector3;
    quat: THREE.Quaternion;
    opts?: PlantPartParams;
    geomIndex: number;
}

class PlantNode {
    children: PlantNode[] = [];
    leaves: LeafData[] = [];
    leafWeightSum: number = 0;   // Sum of weights of leaves attached directly to this node
    branchWeight: number = 0;    // Weight of the branch segment leading to this node
    load: number = 0;            // The total "Pipe" value (sum of leaves and branch weights above)
    radiusStart: number = 0;     // Calculated in Pass 2
    radiusEnd: number = 0;       // Calculated in Pass 2
    quat: THREE.Quaternion = new THREE.Quaternion(); // Orientation leading to this node

    constructor(
        public position: THREE.Vector3,
        public level: number,
        public opts?: any,
        public geomIndex: number = 0
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
        const newNode = new PlantNode(endPos, this.stack.length, this.state.branch.opts, this.state.branch.geomIndex ?? 0);
        newNode.branchWeight = this.state.branch.weight ?? 0.0;
        newNode.quat.copy(this.state.quat); // Store orientation that created this branch
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
            opts: params?.opts,
            geomIndex: params?.geomIndex ?? 1
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

            // The further from the trunk, the more gravity wins
            const strength = Math.min(0.95, Math.abs(forces.gravity) * flexibility);
            this.applyDirectionalForce(currentQuat, targetVec, strength);
        }

        // --- FORCE B: WIND (Highly dependent on flexibility) ---
        if (forces.windForce > 0 && forces.wind && forces.wind.lengthSq() > 0) {
            // Wind affects thin branches much more than thick trunks
            const strength = Math.min(0.8, forces.windForce * flexibility);
            this.applyDirectionalForce(currentQuat, forces.wind, strength);
        }

        // --- FORCE C: HELIOTROPISM (Seeking light) ---
        if (forces.heliotropism !== 0) {
            const skyVec = new THREE.Vector3(0, 1, 0);

            // Young shoots (high level) are more phototropic than old wood
            const strength = Math.min(0.5, forces.heliotropism * flexibility);
            this.applyDirectionalForce(currentQuat, skyVec, strength);
        }

        // --- FORCE D: HORIZON BIAS (Growth Strategy) ---
        // Note: We don't multiply by flexibility here because this is an 
        // architectural "intent" of the plant stage (T, A, C), not a physical sag.
        if (forces.horizonBias !== 0) {
            const targetDir = forces.horizonBias > 0
                ? new THREE.Vector3(currentDir.x, 0, currentDir.z).normalize()
                : new THREE.Vector3(0, 1, 0);

            if (targetDir.lengthSq() > 0) {
                this.applyDirectionalForce(currentQuat, targetDir, Math.abs(forces.horizonBias));
            }
        }

        // --- FORCE E: ANTI-SHADOWING (Growth Strategy) ---
        if (forces.antiShadow !== 0) {
            const awayFromCenter = new THREE.Vector3(currentPos.x, 0, currentPos.z).normalize();
            if (awayFromCenter.lengthSq() > 0) {
                this.applyDirectionalForce(currentQuat, awayFromCenter, forces.antiShadow);
            }
        }

        return currentQuat;
    }

    /**
     * Rotates the current orientation such that the direction it points (UP) 
     * moves towards targetVec by the given strength, while minimizing 
     * change to other axes (roll).
     */
    private applyDirectionalForce(
        currentQuat: THREE.Quaternion,
        targetVec: THREE.Vector3,
        strength: number
    ) {
        if (strength <= 0) return currentQuat;

        const currentDir = new THREE.Vector3(0, 1, 0).applyQuaternion(currentQuat);
        const targetDir = targetVec.clone().normalize();

        // Calculate the shortest-arc rotation between current direction and target direction
        const deltaQuat = new THREE.Quaternion().setFromUnitVectors(currentDir, targetDir);

        // Slerp from identity to the delta based on strength
        const identity = new THREE.Quaternion();
        const partialDelta = identity.slerp(deltaQuat, strength);

        // Apply the partial rotation PRE-multiplied
        // We want to rotate the current orientation BY the delta.
        currentQuat.premultiply(partialDelta);

        return currentQuat;
    }
};

/**
 * L-SYSTEM 3D PLANT GENERATION LOGIC
 */
export class ProceduralPlant {
    branches: BranchData[] = [];
    leaves: LeafData[] = [];

    /**
     * Sanitizes a plant configuration, converting plain objects with x, y, z properties
     * back into THREE.Vector3 instances. This is necessary when loading configs from
     * serialized JSON (e.g., in the plant designer).
     */
    public static sanitizeConfig(obj: any) {
        if (!obj || typeof obj !== 'object') return;

        for (const key in obj) {
            const value = obj[key];
            if (value && typeof value === 'object') {
                if (
                    typeof value.x === 'number' &&
                    typeof value.y === 'number' &&
                    typeof value.z === 'number' &&
                    !(value instanceof THREE.Vector3)
                ) {
                    obj[key] = new THREE.Vector3(value.x, value.y, value.z);
                } else {
                    ProceduralPlant.sanitizeConfig(value);
                }
            }
        }
    }

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
            for (let j = 0; j < current.length; j++) {
                const symbol = current[j];
                let count = 0;

                // Look ahead for {count}
                if (j + 1 < current.length && current[j + 1] === '{') {
                    let start = j + 2;
                    let end = current.indexOf('}', start);
                    if (end !== -1) {
                        count = parseInt(current.substring(start, end));
                        j = end; // Skip the {count} part
                    }
                }

                const rule = config.rules[symbol];

                if (!rule) {
                    next += symbol;
                    continue;
                } else if (isLast) {
                    next += (config.finalRule || "+");
                    continue;
                }

                const result = typeof rule === 'function' ? rule(i, count) : rule;

                let successor = "";
                if (result.successor) {
                    successor = result.successor;
                } else if (result.successors) {
                    const weights = result.weights || new Array(result.successors.length).fill(1);
                    const totalWeight = weights.reduce((a, b) => a + b, 0);
                    const roll = Math.random() * totalWeight;
                    let acc = 0;
                    for (let k = 0; k < result.successors.length; k++) {
                        acc += weights[k];
                        if (roll < acc) {
                            successor = result.successors[k];
                            break;
                        }
                    }
                }

                // Process {+} and {-} in successor
                if (successor.includes('{+') || successor.includes('{-')) {
                    successor = successor.replace(/\{\+\}/g, `{${count + 1}}`);
                    successor = successor.replace(/\{\-\}/g, `{${count - 1}}`);
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
            geomIndex: 0,

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

            ...config?.defaults?.branch ?? {}
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

        for (let i = 0; i < instructions.length; i++) {
            const symbol = instructions[i];

            // Skip {count} tokens
            if (i + 1 < instructions.length && instructions[i + 1] === '{') {
                let end = instructions.indexOf('}', i + 2);
                if (end !== -1) {
                    i = end;
                }
            }

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

        // 2b. This is now handled after Pass 3 because tapering depends on final lengths.


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


        // --- PASS 3.5: APPLY RADII (With Tapering) ---
        const trunkThickness = config.params.thickness || 1.0;
        const power = config.params.thicknessDecay || 0.5;
        const taperRate = config.params.taperRate || 0.0;
        const minTwigRadius = config.params.minTwigRadius || 0.01;
        const rootLoad = root.load;
        const scaler = rootLoad > 0 ? trunkThickness / Math.pow(rootLoad, power) : trunkThickness;

        const applyRadii = (node: PlantNode, parentPos: THREE.Vector3, parentEndRadius?: number) => {
            // 1. Get standard pipe load radius
            let baseRadius = scaler * Math.pow(node.load, power);

            // 2. Connectivity constraint: don't be wider than parent
            if (parentEndRadius !== undefined) {
                baseRadius = Math.min(baseRadius, parentEndRadius);
            }

            // 3. Apply taper
            const length = node.position.distanceTo(parentPos);
            const taperReduction = length * taperRate;
            let endRadius = baseRadius - taperReduction;

            // 4. Enforce floor
            endRadius = Math.max(endRadius, minTwigRadius);

            node.radiusStart = baseRadius;
            node.radiusEnd = endRadius;

            for (let child of node.children) {
                applyRadii(child, node.position, endRadius);
            }
        };
        applyRadii(root, new THREE.Vector3(0, 0, 0));


        // --- PASS 4: GEOMETRY AND LEAF COLLECTION ---
        const generateBranchList = (node: PlantNode, parentBranch?: BranchData) => {
            // Collect leaves on this node
            for (const leaf of node.leaves) {
                this.leaves.push(leaf);
            }

            // Collect branches to children
            for (let child of node.children) {
                const branch: BranchData = {
                    start: node.position.clone(),
                    end: child.position.clone(),
                    radiusStart: node.radiusEnd,
                    radiusEnd: child.radiusEnd,
                    level: child.level,
                    quat: child.quat.clone(),
                    opts: child.opts,
                    geomIndex: child.geomIndex
                };

                // Link for seamless joining if this is a simple sequence with same kind
                if (parentBranch && node.children.length === 1) {
                    if (parentBranch.opts?.kind === branch.opts?.kind) {
                        branch.prev = parentBranch;
                        parentBranch.next = branch;
                    }
                }

                this.branches.push(branch);
                generateBranchList(child, branch);
            }
        };
        generateBranchList(root);
    }
}
