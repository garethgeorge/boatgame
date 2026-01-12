import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

export type LSystemTreeKind = 'willow' | 'poplar' | 'oak' | 'elm' | 'umbrella' | 'open' | 'irregular';

interface LSystemRuleGroup {
    levels: [number, number]; // [min, max] levels (inclusive, use Infinity for no max)
    successors: string[];     // Successor strings for 'X'
    weights: number[];        // Probabilities for each successor
}

type TreeShape = 'default' | 'umbrella';
interface DefaultTreeShapeParams { name: 'default', gravity: number };
interface UmbrellaTreeShapeParams { name: 'umbrella', strength: number, minLevel: number };

type LeafKind = 'blob' | 'willow' | 'irregular' | 'cluster' | 'umbrella';
interface BlobLeafKindParams {
    name: 'blob'; color: number; size: number; thickness: number;
}
interface WillowLeafKindParams {
    name: 'willow', color: number
};
interface IrregularLeafKindParams {
    name: 'irregular', color: number; size: number; thickness: number;
}
interface ClusterLeafKindParams {
    name: 'cluster', color: number; size: number; thickness: number; leaves: number; leafSize: number;
}
interface UmbrellaLeafKindParams {
    name: 'umbrella', color: number; size: number; leaves: number; leafSize: number;
}

interface TreeParams {
    // L-system string generation parameters. The starting axiom, derivation
    // rules and number of iterations to run
    axiom: string;
    rules: LSystemRuleGroup[];
    iterations: number;

    // Interpretation parameters describe how the string is interpreted by
    // the turtle graphics to generate geometry
    spread: number;        // '&' tip down angle in degrees away from parent branch 
    jitter: number;        // Randomness in degrees for both tip down and rotate around parent
    branchLength: number;  // Starting length of the trunk branch
    lengthDecay: number;   // How much shorter child branches are (e.g. 0.8)
    trunkLengthMultiplier: number; // Optional multiplier for the initial segment
    thickness: number;     // Starting radius of the trunk
    thicknessDecay: number; // Ratio for branch tapering (e.g. 0.7)
    leafKind: BlobLeafKindParams | WillowLeafKindParams | IrregularLeafKindParams | ClusterLeafKindParams | UmbrellaLeafKindParams;
    treeShape: DefaultTreeShapeParams | UmbrellaTreeShapeParams;
}

const ARCHETYPES: Record<LSystemTreeKind, TreeParams> = {
    willow: {
        axiom: "FX",
        rules: [
            {
                levels: [0, 3],
                successors: ["F[&&X]/[&&X]/[&&X]"],
                weights: [1.0]
            },
            {
                levels: [4, Infinity],
                successors: ["FX", "L"],
                weights: [0.9, 0.1]
            }
        ],
        iterations: 8,
        spread: 22.9,
        jitter: 11.5,
        branchLength: 3,
        lengthDecay: 0.8,
        trunkLengthMultiplier: 1.5,
        thickness: 0.7,
        thicknessDecay: 0.6,
        leafKind: { name: 'willow', color: 0x41b98d },
        treeShape: { name: 'default', gravity: -0.25 }
    },
    poplar: {
        axiom: "X",
        rules: [
            {
                levels: [0, Infinity],
                successors: ["F[&X]/X"],
                weights: [1.0]
            }
        ],
        iterations: 7,
        spread: 5.7,
        jitter: 2.9,
        branchLength: 2,
        lengthDecay: 0.75,
        trunkLengthMultiplier: 1.2,
        thickness: 0.5,
        thicknessDecay: 0.75,
        leafKind: { name: 'blob', color: 0x3ea043, size: 1.0, thickness: 2.5 },
        treeShape: { name: 'default', gravity: 0.15 }
    },
    oak: {
        axiom: "FX",
        rules: [
            {
                levels: [0, 2],
                successors: ["F[&X]/[&X]", "F[&X]/[&X]/[&X]"],
                weights: [0.5, 0.5]
            },
            {
                levels: [3, Infinity],
                successors: ["F[&X]/[&X]", "F[&X]/[&X]/[&X]", "L"],
                weights: [0.4, 0.4, 0.2]
            }
        ],
        iterations: 6,
        spread: 63.0,
        jitter: 17.2,
        branchLength: 4.0,
        lengthDecay: 0.8,
        trunkLengthMultiplier: 1.5,
        thickness: 0.9,
        thicknessDecay: 0.75,
        leafKind: { name: 'blob', color: 0x228B22, size: 1.8, thickness: 0.6 },
        treeShape: { name: 'default', gravity: -0.05 }
    },
    elm: {
        axiom: "X",
        rules: [
            {
                levels: [0, Infinity],
                successors: ["F[&X]/[&X]/[&X]", "F[&X]/[&X]"],
                weights: [0.7, 0.3]
            }
        ],
        iterations: 6,
        spread: 34.4,
        jitter: 5.7,
        branchLength: 6,
        lengthDecay: 0.7,
        trunkLengthMultiplier: 1.5,
        thickness: 0.8,
        thicknessDecay: 0.7,
        leafKind: { name: 'cluster', color: 0x2e8b57, size: 1.0, thickness: 0.3, leaves: 4, leafSize: 0.8 },
        treeShape: { name: 'default', gravity: 0.0 }
    },
    umbrella: { // Stone Pine / Acacia style
        axiom: "X",
        rules: [
            {   // trunk
                levels: [0, 0],
                successors: ["FFF[&X]/[&X]/[&X]"],
                weights: [1.0]
            },
            {   // arms
                levels: [1, 1],
                successors: ["FFF[&X]/[&X]"],
                weights: [1.0]
            },
            {   // canopy
                levels: [2, Infinity],
                successors: ["F[&X]/[&X]"],
                weights: [1.0]
            }
        ],
        iterations: 6,
        spread: 20,
        jitter: 5,
        branchLength: 2.0,
        lengthDecay: 0.9,
        trunkLengthMultiplier: 2.0,
        thickness: 0.6,
        thicknessDecay: 0.8,
        leafKind: { name: 'umbrella', color: 0x1a4a1c, size: 2.0, leaves: 10, leafSize: 0.8 },
        treeShape: { name: 'umbrella', strength: 0.5, minLevel: 2 }
    },
    open: { // Japanese Maple / Birch style
        axiom: "FX",
        rules: [
            {
                levels: [0, 0],
                successors: ["&F/&FX", "/&F/&FX"],
                weights: [0.5, 0.5]
            },
            {
                levels: [1, 3],
                successors: ["F[&X]/[&X]", "F[&X]"],
                weights: [0.8, 0.2]
            },
            {
                levels: [4, Infinity],
                successors: ["F[&X]/[&FL]", "F[&FL]/[&X]"],
                weights: [0.5, 0.5]
            },
        ],
        iterations: 6,
        spread: 40,
        jitter: 10,
        branchLength: 1.5,
        lengthDecay: 0.9,
        trunkLengthMultiplier: 1.0,
        thickness: 0.3,
        thicknessDecay: 0.7,
        leafKind: { name: 'cluster', color: 0xa03e3e, size: 1.0, thickness: 0.3, leaves: 20, leafSize: 0.6 },
        treeShape: { name: 'default', gravity: 0.0 }
    },
    irregular: { // Monterey Cypress / Gnarled Oak style
        axiom: "X",
        rules: [
            {
                levels: [0, 2],
                successors: ["F[&X]", "F/&X", "F[&X]/[&X]"],
                weights: [0.2, 0.2, 0.6]
            },
            {
                levels: [2, 3],
                successors: ["F[&X]/[&X]"],
                weights: [1.0]
            },
            {
                levels: [4, Infinity],
                successors: ["F[&X]", "F/&X", "F[&X]/[&X]", "L"],
                weights: [0.1, 0.1, 0.7, 0.1]
            }
        ],
        iterations: 12,
        spread: 40.1,
        jitter: 28.6,
        branchLength: 2.5,
        lengthDecay: 0.7,
        trunkLengthMultiplier: 1.5,
        thickness: 0.4,
        thicknessDecay: 0.7,
        leafKind: { name: 'cluster', color: 0x2d5a27, size: 1.0, thickness: 0.1, leaves: 4, leafSize: 0.8 },
        treeShape: { name: 'default', gravity: 0.1 }
    }
};

interface BranchData {
    start: THREE.Vector3;
    end: THREE.Vector3;
    radiusStart: number;
    radiusEnd: number;
    level: number;
}

interface LeafData {
    pos: THREE.Vector3;
    dir: THREE.Vector3;
}

interface LeafGenerator {
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void;
}

class BlobLeafGenerator implements LeafGenerator {
    constructor(readonly params: BlobLeafKindParams) {
    }
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseSize = (1.0 + Math.random() * 0.5) * this.params.size;
        let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(baseSize, 0);

        // Convert to non-indexed to ensure flat shading catches the light correctly per-face
        geo = geo.toNonIndexed();
        geo.computeVertexNormals();

        // thickness scaling (local Y before orientation)
        geo.scale(1, this.params.thickness, 1);

        // Transformation: Orient to face leafData.dir and translate to leafData.pos
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const matrix = new THREE.Matrix4().compose(leafData.pos, quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const color = new THREE.Color(this.params.color);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        GraphicsUtils.addVertexColors(geo, color);

        leafGeos.push(geo);
    }
}

const getOffsetSpherePoint = (center: THREE.Vector3, baseRadius: number, jitter: number): THREE.Vector3 => {
    // 1. Get a random point on a unit sphere (Direction)
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1); // Corrects for pole clustering

    const dir = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
    );

    // 2. Randomize the distance (The "Offset")
    // This pushes the point inside or outside the base shell
    const offset = (Math.random() - 0.5) * 2 * jitter;
    const finalRadius = baseRadius + offset;

    // 3. Scale direction by radius and add to center
    return dir.multiplyScalar(finalRadius).add(center);
}

class WillowLeafGenerator implements LeafGenerator {
    constructor(readonly params: WillowLeafKindParams) {
    }
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const strandCount = 2 + Math.floor(Math.random() * 3);
        const targetGroundClearance = 2.0;

        for (let i = 0; i < strandCount; i++) {
            const isTerminal = i === strandCount - 1;
            const posAlongFrond = isTerminal ? 1.0 : Math.random();

            // We'll grow a strand downwards from the leaf position
            const sLen = Math.max(1.0, leafData.pos.y - targetGroundClearance) * (0.8 + Math.random() * 0.4);
            const sWidth = 0.15 + Math.random() * 0.1;

            const strandGeo = new THREE.BoxGeometry(sWidth, sLen, sWidth / 2, 1, 8, 1);
            strandGeo.translate(0, sLen / 2, 0);

            // Apply droop
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

class IrregularLeafGenerator implements LeafGenerator {
    constructor(readonly params: IrregularLeafKindParams) {
    }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseRadius = (1.0 + Math.random() * 0.5) * this.params.size;
        const jitter = baseRadius * 0.25;

        // Generate a random point cloud
        const points: THREE.Vector3[] = [];
        const pointCount = 10;
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < pointCount; i++) {
            points.push(getOffsetSpherePoint(center, baseRadius, jitter));
        }

        let geo: THREE.BufferGeometry = new ConvexGeometry(points);

        // Convert to non-indexed and update normals
        geo = geo.toNonIndexed();
        geo.computeVertexNormals();

        // thickness scaling (local Y before orientation)
        geo.scale(1, this.params.thickness, 1);

        // Transformation: Orient to face leafData.dir and translate to leafData.pos
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const matrix = new THREE.Matrix4().compose(leafData.pos, quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const color = new THREE.Color(this.params.color);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        GraphicsUtils.addVertexColors(geo, color);

        leafGeos.push(geo);
    }
}

class ClusterLeafGenerator implements LeafGenerator {
    constructor(readonly params: ClusterLeafKindParams) {
    }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseRadius = (1.0 + Math.random() * 0.5) * this.params.size;
        const jitter = baseRadius * 0.25;
        const center = new THREE.Vector3(0, 0, 0);

        const variation = 0.25;
        const numTriangles = Math.max(1, Math.floor(this.params.leaves * (1 + (Math.random() - 0.5) * 2 * variation)));

        const triangleGeos: THREE.BufferGeometry[] = [];

        for (let i = 0; i < numTriangles; i++) {
            // 1. Generate point P using spherical offset
            const P = getOffsetSpherePoint(center, baseRadius, jitter);

            // 2. Apply thickness scaling to the point P
            P.y *= this.params.thickness;

            // 3. Vector Vout from origin to P
            const Vout = P.clone().normalize();

            // 4. Create a triangle at P oriented to face Vout
            // A simple triangle in the X-Z plane, then orient its normal (0, 1, 0) to Vout
            const triSize = this.params.leafSize * baseRadius;
            const triGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -triSize / 2, 0, -triSize / 2,
                triSize / 2, 0, -triSize / 2,
                0, 0, triSize / 2
            ]);
            triGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            triGeo.computeVertexNormals();

            // Orient and translate
            const triQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Vout);
            const triMatrix = new THREE.Matrix4().compose(P, triQuat, new THREE.Vector3(1, 1, 1));
            triGeo.applyMatrix4(triMatrix);

            // Per-triangle color jitter
            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
            GraphicsUtils.addVertexColors(triGeo, color);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) return;

        // Transformation: Orient to face leafData.dir and translate to leafData.pos
        const finalQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, finalQuat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        leafGeos.push(mergedTriangles);
    }
}

class UmbrellaLeafGenerator implements LeafGenerator {
    constructor(readonly params: UmbrellaLeafKindParams) {
    }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const radius = this.params.size;
        const variation = 0.25;
        const numTriangles = Math.max(1, Math.floor(this.params.leaves * (1 + (Math.random() - 0.5) * 2 * variation)));

        const triangleGeos: THREE.BufferGeometry[] = [];
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < numTriangles; i++) {
            // 1. Generate a point on the UPPER hemisphere only
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos(Math.random()); // Random 0 to 1 instead of -1 to 1 for upper hemishphere

            const pos = new THREE.Vector3(
                Math.sin(theta) * Math.cos(phi),
                Math.sin(theta) * Math.sin(phi),
                Math.cos(theta)
            );

            // 2. Apply "Plateau" scaling
            // Wide on X/Z, very flat on Y
            pos.x *= radius * 1.5;
            pos.z *= radius * 1.5;
            pos.y *= radius * 0.4;

            // 3. Create the triangle 'leaf'
            const triSize = this.params.leafSize * radius;
            const triGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -triSize / 2, 0, -triSize / 2,
                triSize / 2, 0, -triSize / 2,
                0, 0, triSize / 2
            ]);
            triGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            triGeo.computeVertexNormals();

            // 4. Align the triangle to the "Upper" normal
            // This ensures the faces catch top-down light like a roof
            const lookDir = pos.clone().add(new THREE.Vector3(0, 1, 0)).normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookDir);

            const matrix = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
            triGeo.applyMatrix4(matrix);

            // Per-triangle color jitter
            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
            GraphicsUtils.addVertexColors(triGeo, color);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) return;

        // Transformation: For umbrella trees, clusters should always point upward (World-Up).
        // Apply a random Y-axis rotation for variety and translate to leafData.pos.
        const finalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, finalQuat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        leafGeos.push(mergedTriangles);
    }
}

interface TreeShapeStrategy {
    applyOrientationInfluence(quat: THREE.Quaternion, level: number, currentDir: THREE.Vector3): void;
}

class DefaultTreeShapeStrategy implements TreeShapeStrategy {
    constructor(readonly params: DefaultTreeShapeParams) {
    }
    applyOrientationInfluence(quat: THREE.Quaternion, level: number, currentDir: THREE.Vector3): void {
        const gravity = this.params.gravity;
        if (gravity !== 0) {
            const pullDir = gravity > 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pullDir);
            quat.slerp(targetQuat, Math.abs(gravity) * (level + 1) * 0.2);
        }
    }
}

class UmbrellaTreeShapeStrategy implements TreeShapeStrategy {
    constructor(readonly params: UmbrellaTreeShapeParams) {
    }
    applyOrientationInfluence(quat: THREE.Quaternion, level: number, currentDir: THREE.Vector3): void {
        if (level >= this.params.minLevel) {
            // Create a "Horizon Target" by stripping the Y (vertical) component
            const horizonDir = new THREE.Vector3(currentDir.x, 0, currentDir.z).normalize();
            if (horizonDir.lengthSq() > 0.001) {
                // Create a Quaternion that represents facing that horizon
                const horizonQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), horizonDir);
                // Blend the current rotation toward the horizon
                // higher strength makes the umbrella flatter
                quat.slerp(horizonQuat, this.params.strength);
            }
        }
    }
}

/**
 * L-SYSTEM 3D TREE GENERATION LOGIC
 * * The algorithm uses a "Turtle Graphics" approach where a string of 
 * characters dictates how a 3D cursor (the turtle) moves and branches.
 * * SYMBOL GUIDE:
 * F : Move Forward  -> Draws a branch segment (Cylinder).
 * X : Growth Point  -> A "bud" that expands into more branches in next gen.
 * [ : Push State    -> Saves current Position/Rotation to a stack (Start branch).
 * ] : Pop State     -> Returns to the last saved Position/Rotation (End branch).
 * & : Pitch Down    -> Tilts the turtle away from the center (Controls Spread).
 * / : Yaw Rotate    -> Spins the turtle around the stem (Radial distribution).
 * * STOCHASTIC EXPANSION:
 * Rules are applied recursively. Example: X -> F [&X] / [&X] / [&X]
 * Generation 0: X (Seed)
 * Generation 1: Trunk + 3 Main Buds
 * Generation 2: Trunk + 3 Main Branches + 9 Sub-Branches
 * * FORM CONTROL:
 * - Weeping:  Slerp the orientation (Quaternion) toward [0, -1, 0] during 'F'.
 * - Columnar: Use a small '&' angle and slerp toward [0, 1, 0].
 * - Umbrella: Delay the '&' branching until the final generation.
 */
class ProceduralTree {
    branches: BranchData[] = [];
    leaves: LeafData[] = [];

    generate(params: TreeParams) {
        this.branches = [];
        this.leaves = [];

        let axiom = params.axiom;
        for (let i = 0; i < params.iterations; i++) {
            axiom = this.expand(params, axiom, i);
        }

        this.interpret(axiom, params);
    }

    private expand(params: TreeParams, input: string, currentLevel: number): string {
        const isLast = currentLevel === params.iterations - 1;

        // Find the rule group for this level
        const group = params.rules.find(r => currentLevel >= r.levels[0] && currentLevel <= r.levels[1]);

        let result = "";
        for (const char of input) {
            if (char === 'X') {
                if (isLast) {
                    result += "L";
                    continue;
                }

                if (!group) {
                    // Fallback to simple growth if no rule matches
                    result += "F[&X]/[&X]/[&X]";
                    continue;
                }

                const roll = Math.random();
                let acc = 0;
                let successor = group.successors[group.successors.length - 1]; // Default to last

                for (let i = 0; i < group.successors.length; i++) {
                    acc += group.weights[i];
                    if (roll < acc) {
                        successor = group.successors[i];
                        break;
                    }
                }
                result += successor;
            } else {
                result += char;
            }
        }
        return result;
    }

    private interpret(instructions: string, params: TreeParams) {
        const treeShapeStrategy = this.createTreeShapeStrategy(params);

        let stack: { pos: THREE.Vector3, quat: THREE.Quaternion, thick: number, level: number }[] = [];
        let currPos = new THREE.Vector3(0, 0, 0);
        let currQuat = new THREE.Quaternion();
        let currThick = params.thickness;
        let level = 0;

        for (const symbol of instructions) {
            switch (symbol) {
                case 'F':
                case 'L': {
                    let length = params.branchLength * Math.pow(params.lengthDecay, level);
                    if (level === 0 && params.trunkLengthMultiplier) {
                        length *= params.trunkLengthMultiplier;
                    }
                    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(currQuat);

                    treeShapeStrategy.applyOrientationInfluence(currQuat, level, dir);

                    const endPos = currPos.clone().add(dir.multiplyScalar(length));
                    const nextThick = currThick * params.thicknessDecay;
                    this.branches.push({
                        start: currPos.clone(),
                        end: endPos.clone(),
                        radiusStart: currThick,
                        radiusEnd: nextThick,
                        level
                    });

                    if (symbol === 'L') {
                        this.leaves.push({ pos: endPos.clone(), dir: dir.clone() });
                    }
                    currPos.copy(endPos);
                    currThick = nextThick;
                    break;
                }
                case '[':
                    stack.push({ pos: currPos.clone(), quat: currQuat.clone(), thick: currThick, level });
                    level++;
                    break;
                case ']':
                    const prev = stack.pop()!;
                    currPos.copy(prev.pos);
                    currQuat.copy(prev.quat);
                    currThick = prev.thick;
                    level = prev.level;
                    break;
                case '&': {
                    const pitchAngle = THREE.MathUtils.degToRad(params.spread + (Math.random() - 0.5) * params.jitter);
                    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchAngle);
                    currQuat.multiply(pitch);
                    break;
                }
                case '/': {
                    // const yawAngle = ((Math.PI * 2) / 3) + (Math.random() - 0.5) * params.jitter;
                    const goldenAngle = 2.399;
                    const yawAngle = goldenAngle + (Math.random() - 0.5) * THREE.MathUtils.degToRad(params.jitter);
                    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
                    currQuat.multiply(yaw);
                    break;
                }
            }
        }
    }

    private createTreeShapeStrategy(params: TreeParams): TreeShapeStrategy {
        switch (params.treeShape.name) {
            case 'umbrella':
                return new UmbrellaTreeShapeStrategy(params.treeShape);
            case 'default':
            default:
                return new DefaultTreeShapeStrategy(params.treeShape);
        }
    }
}

interface TreeArchetype {
    woodGeo: THREE.BufferGeometry;
    leafGeo: THREE.BufferGeometry;
    kind: LSystemTreeKind;
    variation: number; // 0 to 1
}

export class LSystemTreeFactory implements DecorationFactory {
    private static readonly woodMaterial = new THREE.MeshToonMaterial({ color: 0x4b3621, name: 'LSystemTree - Wood' });
    private static readonly leafMaterial = new THREE.MeshToonMaterial({ color: 0xffffff, name: 'LSystemTree - Leaf', vertexColors: true, side: THREE.DoubleSide });

    private archetypes: Map<LSystemTreeKind, TreeArchetype[]> = new Map();

    async load(): Promise<void> {
        GraphicsUtils.registerObject(LSystemTreeFactory.woodMaterial);
        GraphicsUtils.registerObject(LSystemTreeFactory.leafMaterial);

        const treeGen = new ProceduralTree();

        for (const kind of Object.keys(ARCHETYPES) as LSystemTreeKind[]) {
            const params = ARCHETYPES[kind];
            const list: TreeArchetype[] = [];
            for (let i = 0; i < 10; i++) {
                treeGen.generate(params);
                list.push(this.createArchetype(kind, i / 10, treeGen, params));
            }
            this.archetypes.set(kind, list);
        }
    }

    private createArchetype(kind: LSystemTreeKind, variation: number, tree: ProceduralTree, params: TreeParams): TreeArchetype {
        const leafGenerator = this.createLeafGenerator(params);
        const woodGeos: THREE.BufferGeometry[] = [];
        const leafGeos: THREE.BufferGeometry[] = [];

        for (const branch of tree.branches) {
            const height = branch.start.distanceTo(branch.end);
            const geo = new THREE.CylinderGeometry(branch.radiusEnd, branch.radiusStart, height, 6);

            const midpoint = new THREE.Vector3().addVectors(branch.start, branch.end).multiplyScalar(0.5);
            const direction = new THREE.Vector3().subVectors(branch.end, branch.start).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

            const matrix = new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1));
            geo.applyMatrix4(matrix);
            woodGeos.push(geo);
        }

        for (const leaf of tree.leaves) {
            leafGenerator.addLeaves(leafGeos, leaf);
        }

        const mergedWood = this.mergeGeometries(woodGeos, `LSystemWood_${kind}_${variation}`);
        const mergedLeaves = this.mergeGeometries(leafGeos, `LSystemLeaves_${kind}_${variation}`);

        woodGeos.forEach(g => g.dispose());
        leafGeos.forEach(g => g.dispose());

        return { woodGeo: mergedWood, leafGeo: mergedLeaves, kind, variation };
    }

    private createLeafGenerator(params: TreeParams): LeafGenerator {
        switch (params.leafKind.name) {
            case 'willow':
                return new WillowLeafGenerator(params.leafKind);
            case 'irregular':
                return new IrregularLeafGenerator(params.leafKind);
            case 'cluster':
                return new ClusterLeafGenerator(params.leafKind);
            case 'umbrella':
                return new UmbrellaLeafGenerator(params.leafKind);
            case 'blob':
            default:
                return new BlobLeafGenerator(params.leafKind);
        }
    }

    private mergeGeometries(geos: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
        if (geos.length === 0) {
            const empty = new THREE.BufferGeometry();
            empty.name = name;
            GraphicsUtils.registerObject(empty);
            return empty;
        }
        const merged = BufferGeometryUtils.mergeGeometries(geos)!;
        merged.name = name;
        GraphicsUtils.registerObject(merged);
        return merged;
    }

    createInstance(options: { kind: LSystemTreeKind, variation?: number }): DecorationInstance[] {
        const { kind, variation = Math.random() } = options;
        const list = this.archetypes.get(kind) || this.archetypes.get('oak')!;

        let best = list[0];
        let minDist = Infinity;
        for (const a of list) {
            const d = Math.abs(a.variation - variation);
            if (d < minDist) {
                minDist = d;
                best = a;
            }
        }

        return [
            {
                geometry: best.woodGeo,
                material: LSystemTreeFactory.woodMaterial,
                matrix: new THREE.Matrix4()
            },
            {
                geometry: best.leafGeo,
                material: LSystemTreeFactory.leafMaterial,
                matrix: new THREE.Matrix4()
            }
        ];
    }
}
