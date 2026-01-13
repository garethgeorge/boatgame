import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
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

export interface LeafGenerator {
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void;
}

export class BlobLeafGenerator implements LeafGenerator {
    constructor(readonly params: BlobLeafKindParams) { }
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseSize = (1.0 + Math.random() * 0.5) * this.params.size;
        let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(baseSize, 0);

        if (geo.index) {
            geo = geo.toNonIndexed();
        }
        geo.computeVertexNormals();

        geo.scale(1, this.params.thickness, 1);

        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const matrix = new THREE.Matrix4().compose(leafData.pos, quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const color = new THREE.Color(this.params.color);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        GraphicsUtils.addVertexColors(geo, color);

        leafGeos.push(geo);
    }
}

export const getOffsetSpherePoint = (center: THREE.Vector3, baseRadius: number, jitter: number): THREE.Vector3 => {
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1);

    const dir = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
    );

    const offset = (Math.random() - 0.5) * 2 * jitter;
    const finalRadius = baseRadius + offset;

    return dir.multiplyScalar(finalRadius).add(center);
}

export class WillowLeafGenerator implements LeafGenerator {
    constructor(readonly params: WillowLeafKindParams) { }
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const strandCount = 2 + Math.floor(Math.random() * 3);
        const targetGroundClearance = 2.0;

        for (let i = 0; i < strandCount; i++) {
            const isTerminal = i === strandCount - 1;
            const sLen = Math.max(1.0, leafData.pos.y - targetGroundClearance) * (0.8 + Math.random() * 0.4);
            const sWidth = 0.15 + Math.random() * 0.1;

            const strandGeo = new THREE.BoxGeometry(sWidth, sLen, sWidth / 2, 1, 8, 1);
            strandGeo.translate(0, sLen / 2, 0);

            this.applyDroop(strandGeo, sLen);

            const radialAngle = Math.random() * Math.PI * 2;
            const jitter = (Math.random() - 0.5) * 0.2;

            const matrix = new THREE.Matrix4().compose(
                leafData.pos,
                new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + jitter, radialAngle, 0, 'YXZ')),
                new THREE.Vector3(1, 1, 1)
            );

            strandGeo.applyMatrix4(matrix);

            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
            GraphicsUtils.addVertexColors(strandGeo, color);

            leafGeos.push(strandGeo);
        }
    }

    private applyDroop(geo: THREE.BufferGeometry, length: number) {
        const positions = geo.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            v.fromBufferAttribute(positions, i);
            const ratio = v.y / length;
            const outward = Math.sin(Math.min(ratio * 2.0, 1.0) * Math.PI * 0.5) * (length * 0.15);
            const downPart = Math.pow(ratio, 2.0) * (length * 1.5);
            v.z += downPart;
            v.y = outward;
            const taper = 1.0 - ratio * 0.3;
            v.x *= taper;
            positions.setXYZ(i, v.x, v.y, v.z);
        }
        positions.needsUpdate = true;
        geo.computeVertexNormals();
    }
}

export class IrregularLeafGenerator implements LeafGenerator {
    constructor(readonly params: IrregularLeafKindParams) { }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseRadius = (1.0 + Math.random() * 0.5) * this.params.size;
        const jitter = baseRadius * 0.25;

        const points: THREE.Vector3[] = [];
        const pointCount = 10;
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < pointCount; i++) {
            points.push(getOffsetSpherePoint(center, baseRadius, jitter));
        }

        let geo: THREE.BufferGeometry = new ConvexGeometry(points);

        if (geo.index) {
            geo = geo.toNonIndexed();
        }
        geo.computeVertexNormals();

        geo.scale(1, this.params.thickness, 1);

        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const matrix = new THREE.Matrix4().compose(leafData.pos, quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const color = new THREE.Color(this.params.color);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        GraphicsUtils.addVertexColors(geo, color);

        leafGeos.push(geo);
    }
}

export class ClusterLeafGenerator implements LeafGenerator {
    constructor(readonly params: ClusterLeafKindParams) { }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseRadius = (1.0 + Math.random() * 0.5) * this.params.size;
        const jitter = baseRadius * 0.25;
        const center = new THREE.Vector3(0, 0, 0);

        const variation = 0.25;
        const numTriangles = Math.max(1, Math.floor(this.params.leaves * (1 + (Math.random() - 0.5) * 2 * variation)));

        const triangleGeos: THREE.BufferGeometry[] = [];

        for (let i = 0; i < numTriangles; i++) {
            const P = getOffsetSpherePoint(center, baseRadius, jitter);
            P.y *= this.params.thickness;
            const Vout = P.clone().normalize();

            const triSize = this.params.leafSize * baseRadius;
            const triGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -triSize / 2, 0, -triSize / 2,
                triSize / 2, 0, -triSize / 2,
                0, 0, triSize / 2
            ]);
            triGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            triGeo.computeVertexNormals();

            const triQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Vout);
            const triMatrix = new THREE.Matrix4().compose(P, triQuat, new THREE.Vector3(1, 1, 1));
            triGeo.applyMatrix4(triMatrix);

            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
            GraphicsUtils.addVertexColors(triGeo, color);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) return;

        const finalQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, finalQuat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        leafGeos.push(mergedTriangles);
    }
}

export class UmbrellaLeafGenerator implements LeafGenerator {
    constructor(readonly params: UmbrellaLeafKindParams) { }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const radius = this.params.size;
        const variation = 0.25;
        const numTriangles = Math.max(1, Math.floor(this.params.leaves * (1 + (Math.random() - 0.5) * 2 * variation)));

        const triangleGeos: THREE.BufferGeometry[] = [];
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < numTriangles; i++) {
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos(Math.random());

            const pos = new THREE.Vector3(
                Math.sin(theta) * Math.cos(phi),
                Math.sin(theta) * Math.sin(phi),
                Math.cos(theta)
            );

            pos.x *= radius * 1.5;
            pos.z *= radius * 1.5;
            pos.y *= radius * 0.4;

            const triSize = this.params.leafSize * radius;
            const triGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -triSize / 2, 0, -triSize / 2,
                triSize / 2, 0, -triSize / 2,
                0, 0, triSize / 2
            ]);
            triGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            triGeo.computeVertexNormals();

            const lookDir = pos.clone().add(new THREE.Vector3(0, 1, 0)).normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookDir);

            const matrix = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
            triGeo.applyMatrix4(matrix);

            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
            GraphicsUtils.addVertexColors(triGeo, color);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) return;

        const finalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, finalQuat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        leafGeos.push(mergedTriangles);
    }
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
            treeShape: { ...config.treeShape.params }
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
        switch (config.treeShape.name) {
            case 'umbrella':
                return new UmbrellaTreeShapeStrategy(config.treeShape.params as UmbrellaTreeShapeParams);
            case 'default':
            default:
                return new DefaultTreeShapeStrategy(config.treeShape.params as DefaultTreeShapeParams);
        }
    }
}
