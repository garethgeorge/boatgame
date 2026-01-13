import * as THREE from 'three';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import {
    TreeConfig,
    TreeParams,
    BlobLeafKindParams,
    WillowLeafKindParams,
    IrregularLeafKindParams,
    ClusterLeafKindParams,
    UmbrellaLeafKindParams,
} from './LSystemTreeArchetypes';
import { dirxml } from 'node:console';

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

        for (let i = 0; i < config.iterations; i++) {
            const isLast = i === config.iterations - 1;
            let next = "";
            for (const symbol of current) {
                const rule = config.rules[symbol];

                if (!rule) {
                    next += symbol;
                    continue;
                } else if (isLast) {
                    next += "+";
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

        interface TurtleState {
            pos: THREE.Vector3;
            quat: THREE.Quaternion;
            params: Required<TreeParams>;
            dist: number;
        }

        const stack: TurtleState[] = [];
        const defaultParams = {
            spread: 45,
            jitter: 5,
            length: 1.0,
            lengthDecay: 0.8,
            thickness: 1.0,
            thicknessDecay: 0.8,

            gravity: 0.0,
            horizonBias: 0.0,
            heliotropism: 0.0,
            wind: new THREE.Vector3(0, 0, 0),
            antiShadow: 0.0
        };

        const turtle: TurtleState = {
            pos: new THREE.Vector3(0, 0, 0),
            quat: new THREE.Quaternion(),
            params: { ...defaultParams, ...config.params } as Required<TreeParams>,
            dist: 0,
        };

        const getScale = (dist: number, params: Required<TreeParams>) => {
            const reference = params.length || 1;
            return {
                lengthScale: Math.pow(params.lengthDecay || 1, dist / reference),
                thicknessScale: Math.pow(params.thicknessDecay || 1, dist / reference)
            };
        };

        for (const symbol of instructions) {
            const rule = config.interpreter?.[symbol];
            if (rule) {
                const result = typeof rule === 'function' ? rule(stack.length) : rule;
                if (result.params) {
                    turtle.params = { ...turtle.params, ...result.params };
                }
            }

            switch (symbol) {
                case '=': {
                    const scales = getScale(turtle.dist, turtle.params);
                    let length = turtle.params.length * scales.lengthScale;

                    if (turtle.dist === 0 && config.trunkLengthMultiplier) {
                        length *= config.trunkLengthMultiplier;
                    }

                    // A. Apply physical forces
                    turtle.quat = this.applyTreeForces(turtle.quat, turtle.pos, turtle.params, stack.length);

                    // B. Calculate end point
                    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(turtle.quat);
                    const endPos = turtle.pos.clone().add(dir.multiplyScalar(length));

                    const radiusStart = turtle.params.thickness * scales.thicknessScale;
                    const endScales = getScale(turtle.dist + length, turtle.params);
                    const radiusEnd = turtle.params.thickness * endScales.thicknessScale;

                    // C. Add branch
                    this.branches.push({
                        start: turtle.pos.clone(),
                        end: endPos.clone(),
                        radiusStart: radiusStart,
                        radiusEnd: radiusEnd,
                        level: stack.length
                    });

                    // D. Move turtle
                    turtle.pos.copy(endPos);
                    turtle.dist += length;
                    break;
                }
                case '+': {
                    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(turtle.quat);
                    this.leaves.push({ pos: turtle.pos.clone(), dir: dir });
                    break;
                }
                case '[':
                    stack.push({
                        pos: turtle.pos.clone(),
                        quat: turtle.quat.clone(),
                        params: { ...turtle.params },
                        dist: turtle.dist,
                    });
                    break;
                case ']':
                    const prev = stack.pop();
                    if (prev) {
                        turtle.pos.copy(prev.pos);
                        turtle.quat.copy(prev.quat);
                        turtle.params = { ...prev.params };
                        turtle.dist = prev.dist;
                    }
                    break;
                case '&': {
                    const spread = turtle.params.spread || 0;
                    const pitchAngle = THREE.MathUtils.degToRad(spread + (Math.random() - 0.5) * (turtle.params.jitter || 0));
                    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchAngle);
                    turtle.quat.multiply(pitch);
                    break;
                }
                case '/': {
                    const goldenAngle = 2.399;
                    const yawAngle = goldenAngle + (Math.random() - 0.5) * THREE.MathUtils.degToRad(turtle.params.jitter || 0);
                    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
                    turtle.quat.multiply(yaw);
                    break;
                }
            }
        }
    }

    private applyTreeForces(
        currentQuat: THREE.Quaternion,
        currentPos: THREE.Vector3,
        forces: TreeParams,
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
        if (forces.wind.lengthSq() > 0) {
            const windDir = forces.wind.clone().normalize();
            const windQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), windDir);

            // Wind affects thin branches much more than thick trunks
            const strength = Math.min(0.8, forces.wind.length() * flexibility);
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
