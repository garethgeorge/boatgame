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
    DefaultTreeShapeParams,
    UmbrellaTreeShapeParams,
    TreeShapeParams
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

export interface TreeShapeStrategy {
    applyOrientationInfluence(quat: THREE.Quaternion, level: number, currentDir: THREE.Vector3, treeShape: any): void;
}

export class DefaultTreeShapeStrategy implements TreeShapeStrategy {
    constructor(readonly params: DefaultTreeShapeParams) { }
    applyOrientationInfluence(quat: THREE.Quaternion, level: number, currentDir: THREE.Vector3, treeShape: any): void {
        const gravity = treeShape.gravity ?? this.params.gravity;
        if (gravity !== 0) {
            const pullDir = gravity > 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pullDir);
            quat.slerp(targetQuat, Math.abs(gravity) * (level + 1) * 0.2);
        }
    }
}

export class UmbrellaTreeShapeStrategy implements TreeShapeStrategy {
    constructor(readonly params: UmbrellaTreeShapeParams) { }
    applyOrientationInfluence(quat: THREE.Quaternion, level: number, currentDir: THREE.Vector3, treeShape: any): void {
        const strength = treeShape.strength ?? this.params.strength;
        const horizonDir = new THREE.Vector3(currentDir.x, 0, currentDir.z).normalize();
        if (horizonDir.lengthSq() > 0.001) {
            const horizonQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), horizonDir);
            quat.slerp(horizonQuat, strength);
        }
    }
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
                    next += "L";
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
        const treeShapeStrategy = this.createTreeShapeStrategy(config);

        interface TurtleState {
            pos: THREE.Vector3;
            quat: THREE.Quaternion;
            thick: number;
            level: number;
            params: Required<TreeParams>;
            treeShape: any;
        }

        const stack: TurtleState[] = [];
        const turtle: TurtleState = {
            pos: new THREE.Vector3(0, 0, 0),
            quat: new THREE.Quaternion(),
            thick: config.thickness,
            level: 0,
            params: { ...config.params } as Required<TreeParams>,
            treeShape: { ...config.treeShape }
        };

        for (const symbol of instructions) {
            const rule = config.interpreter?.[symbol];
            if (rule) {
                const result = typeof rule === 'function' ? rule(stack.length) : rule;
                if (result.params) {
                    turtle.params = { ...turtle.params, ...result.params };
                }
                if (result.shape) {
                    turtle.treeShape = { ...turtle.treeShape, ...result.shape };
                }
            }

            switch (symbol) {
                case 'F':
                case 'L': {
                    let length = config.branchLength * Math.pow(turtle.params.lengthDecay || 1, turtle.level);
                    if (turtle.level === 0 && config.trunkLengthMultiplier) {
                        length *= config.trunkLengthMultiplier;
                    }
                    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(turtle.quat);

                    treeShapeStrategy.applyOrientationInfluence(turtle.quat, turtle.level, dir, turtle.treeShape);

                    const endPos = turtle.pos.clone().add(dir.multiplyScalar(length));
                    const nextThick = turtle.thick * (turtle.params.thicknessDecay || 1);
                    this.branches.push({
                        start: turtle.pos.clone(),
                        end: endPos.clone(),
                        radiusStart: turtle.thick,
                        radiusEnd: nextThick,
                        level: turtle.level
                    });

                    if (symbol === 'L') {
                        this.leaves.push({ pos: endPos.clone(), dir: dir.clone() });
                    }
                    turtle.pos.copy(endPos);
                    turtle.thick = nextThick;
                    break;
                }
                case '[':
                    stack.push({
                        pos: turtle.pos.clone(),
                        quat: turtle.quat.clone(),
                        thick: turtle.thick,
                        level: turtle.level,
                        params: { ...turtle.params },
                        treeShape: { ...turtle.treeShape }
                    });
                    turtle.level++;
                    break;
                case ']':
                    const prev = stack.pop();
                    if (prev) {
                        turtle.pos.copy(prev.pos);
                        turtle.quat.copy(prev.quat);
                        turtle.thick = prev.thick;
                        turtle.level = prev.level;
                        turtle.params = { ...prev.params };
                        turtle.treeShape = { ...prev.treeShape };
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

    private createTreeShapeStrategy(config: TreeConfig): TreeShapeStrategy {
        switch (config.treeShape.kind) {
            case 'umbrella':
                return new UmbrellaTreeShapeStrategy(config.treeShape as UmbrellaTreeShapeParams);
            case 'default':
            default:
                return new DefaultTreeShapeStrategy(config.treeShape as DefaultTreeShapeParams);
        }
    }
}
