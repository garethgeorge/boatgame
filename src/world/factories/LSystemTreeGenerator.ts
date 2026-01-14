import * as THREE from 'three';
import {
    BranchParams,
    TreeConfig,
} from './LSystemTreeArchetypes';

export interface BranchData {
    start: THREE.Vector3;
    end: THREE.Vector3;
    radiusStart: number;
    radiusEnd: number;
    level: number;
}

export interface LeafData {
    pos: THREE.Vector3;
    dir: THREE.Vector3;
}

/**
 * L-SYSTEM 3D TREE GENERATION LOGIC
 */
export class ProceduralTree {
    branches: BranchData[] = [];
    leaves: LeafData[] = [];

    generate(config: TreeConfig) {
        this.branches = [];
        this.leaves = [];

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

    private interpret(instructions: string, config: TreeConfig) {

        // --- DATA STRUCTURES ---
        class TreeNode {
            children: TreeNode[] = [];
            leaves: LeafData[] = [];
            leafCount: number = 0;   // The "Pipe" value
            radius: number = 0;      // Calculated in Pass 2

            constructor(
                public position: THREE.Vector3,
                public level: number
            ) { }
        }

        interface TurtleState {
            pos: THREE.Vector3;
            quat: THREE.Quaternion;
            branch: Required<BranchParams>;
            node: TreeNode;
        }

        // Default parameters for all branches
        const defaultBranch: Required<BranchParams> = {
            spread: 45,
            jitter: 5,
            scale: 1.0,

            gravity: 0.0,
            horizonBias: 0.0,
            heliotropism: 0.0,
            wind: new THREE.Vector3(0, 0, 0),
            windForce: 0,
            antiShadow: 0.0,

            ...config.defaults.branch
        };

        // --- PASS 1: BUILD TOPOLOGY ---
        const root = new TreeNode(new THREE.Vector3(0, 0, 0), 0);

        const turtle: TurtleState = {
            pos: new THREE.Vector3(0, 0, 0),
            quat: new THREE.Quaternion(),
            branch: defaultBranch,
            node: root
        };

        const stack: TurtleState[] = [];

        for (const symbol of instructions) {

            // is symbol a branch?
            const branchParams = config.branches?.[symbol];
            if (branchParams) {
                turtle.branch = { ...defaultBranch, ...branchParams };

                const lengthScale = Math.pow(config.params.lengthDecay, stack.length);
                const length = config.params.length * turtle.branch.scale * lengthScale;

                // A. Apply physical forces
                turtle.quat = this.applyTreeForces(turtle.quat, turtle.pos, turtle.branch, stack.length);

                // B. Calculate end point
                const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(turtle.quat);
                const endPos = turtle.pos.clone().add(dir.multiplyScalar(length));

                // C. Create Graph Node
                const newNode = new TreeNode(endPos, stack.length);
                turtle.node.children.push(newNode);

                // D. Move turtle
                turtle.node = newNode; // Move logical turtle
                turtle.pos.copy(endPos); // Move physical turtle
                continue;
            }

            // handle built-ins
            switch (symbol) {
                case '+': {
                    // This node supports a leaf
                    turtle.node.leafCount += 1;

                    // Also store the visual leaf data for final rendering
                    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(turtle.quat);
                    turtle.node.leaves.push({ pos: turtle.pos.clone(), dir: dir });
                    break;
                }
                case '$': {
                    // Like '+', but forces the leaf direction to be absolute UP (0,1,0)
                    // This creates horizontal pads/canopies regardless of branch orientation
                    turtle.node.leafCount += 1;
                    turtle.node.leaves.push({ pos: turtle.pos.clone(), dir: new THREE.Vector3(0, 1, 0) });
                    break;
                }
                case '[':
                    stack.push({
                        pos: turtle.pos.clone(),
                        quat: turtle.quat.clone(),
                        branch: { ...turtle.branch },
                        node: turtle.node // Save junction point in graph
                    });
                    break;
                case ']':
                    const prev = stack.pop();
                    if (prev) {
                        turtle.pos.copy(prev.pos);
                        turtle.quat.copy(prev.quat);
                        turtle.branch = { ...prev.branch };
                        turtle.node = prev.node; // Return to junction point
                    }
                    break;
                case '&': {
                    const spread = turtle.branch.spread || 0;
                    const pitchAngle = THREE.MathUtils.degToRad(spread + (Math.random() - 0.5) * (turtle.branch.jitter || 0));
                    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchAngle);
                    turtle.quat.multiply(pitch);
                    break;
                }
                case '/': {
                    const goldenAngle = 2.399;
                    const yawAngle = goldenAngle + (Math.random() - 0.5) * THREE.MathUtils.degToRad(turtle.branch.jitter || 0);
                    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
                    turtle.quat.multiply(yaw);
                    break;
                }
            }
        }

        // --- PASS 2: CALCULATE RADII (Back-Propagation) ---

        // 2a. Calculate Load (Leaf Counts)
        const calculateLoad = (node: TreeNode): number => {
            for (let child of node.children) {
                node.leafCount += calculateLoad(child);
            }
            // Base Case: Tip with no leaves gets small value to ensure non-zero radius
            if (node.leafCount === 0) node.leafCount = 0.5;
            return node.leafCount;
        };
        calculateLoad(root);

        // 2b. Apply Radii (Area Preservation)
        const trunkThickness = config.params.thickness || 1.0;
        const power = config.params.thicknessDecay || 0.5;
        const rootLoad = root.leafCount;
        const scaler = rootLoad > 0 ? trunkThickness / Math.pow(rootLoad, power) : trunkThickness;

        const applyRadii = (node: TreeNode) => {
            node.radius = scaler * Math.pow(node.leafCount, power);
            for (let child of node.children) {
                applyRadii(child);
            }
        };
        applyRadii(root);


        // --- PASS 3: LENGTH ADJUSTMENT (Vigor) ---
        const shiftSubtree = (node: TreeNode, offset: THREE.Vector3) => {
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

        const adjustNodesForLength = (node: TreeNode) => {
            for (let child of node.children) {
                // 1. Calculate relative vigor [0..1]
                const vigor = node.leafCount > 0 ? child.leafCount / node.leafCount : 0;

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
        const generateBranchList = (node: TreeNode) => {
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
                    level: child.level
                });
                generateBranchList(child);
            }
        };
        generateBranchList(root);
    }

    private applyTreeForces(
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
        // architectural "intent" of the tree stage (T, A, C), not a physical sag.
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
}
