import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export type LSystemTreeKind = 'willow' | 'poplar' | 'oak' | 'elm';

interface TreeParams {
    spread: number;        // Base angle of branching (radians)
    gravity: number;       // Positive (Up/Columnar) to Negative (Down/Weeping)
    iterations: number;    // Usually 2 or 3 for small trees
    branchLength: number;  // Length of the trunk
    lengthDecay: number;   // How much shorter child branches are (e.g. 0.8)
    minExpansionLevel: number; // Minimum depth before pruning is allowed
    trunkLengthMultiplier: number; // Optional multiplier for the initial segment
    thickness: number;     // Starting radius of the trunk
    thicknessDecay: number; // Ratio for branch tapering (e.g. 0.7)
    jitter: number;        // Organic randomness (0.0 to 0.5)
    leafColor: number;
    leafStrategy: LeafStrategy;
}

interface LeafStrategy {
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData, params: TreeParams): void;
}

class DefaultLeafStrategy implements LeafStrategy {
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData, params: TreeParams): void {
        const leafSize = 1.0 + Math.random() * 0.5;
        const geo = new THREE.IcosahedronGeometry(leafSize, 0);
        geo.applyMatrix4(new THREE.Matrix4().makeTranslation(leafData.pos.x, leafData.pos.y, leafData.pos.z));

        const color = new THREE.Color(params.leafColor);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        GraphicsUtils.addVertexColors(geo, color);

        leafGeos.push(geo);
    }
}

class WillowLeafStrategy implements LeafStrategy {
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData, params: TreeParams): void {
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

            const color = new THREE.Color(params.leafColor);
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

const ARCHETYPES: Record<LSystemTreeKind, TreeParams> = {
    willow: {
        spread: 0.4,
        gravity: -0.5,
        iterations: 5,
        branchLength: 3,
        lengthDecay: 0.8,
        minExpansionLevel: 2,
        trunkLengthMultiplier: 1.5,
        thickness: 0.15,
        thicknessDecay: 0.7,
        jitter: 0.2,
        leafColor: 0x41b98d,
        leafStrategy: new WillowLeafStrategy()
    },
    poplar: {
        spread: 0.1,
        gravity: 0.15,
        iterations: 3,
        branchLength: 3,
        lengthDecay: 0.75,
        minExpansionLevel: 1,
        trunkLengthMultiplier: 1.2,
        thickness: 0.2,
        thicknessDecay: 0.75,
        jitter: 0.05,
        leafColor: 0x3ea043,
        leafStrategy: new DefaultLeafStrategy()
    },
    oak: {
        spread: 1.1,
        gravity: -0.05,
        iterations: 5,
        branchLength: 2.5,
        lengthDecay: 0.8,
        minExpansionLevel: 2,
        trunkLengthMultiplier: 3.0,
        thickness: 0.6,
        thicknessDecay: 0.6,
        jitter: 0.3,
        leafColor: 0x228B22,
        leafStrategy: new DefaultLeafStrategy()
    },
    elm: {
        spread: 0.6,
        gravity: 0.0,
        iterations: 5,
        branchLength: 4,
        lengthDecay: 0.7,
        minExpansionLevel: 2,
        trunkLengthMultiplier: 1.5,
        thickness: 0.25,
        thicknessDecay: 0.7,
        jitter: 0.1,
        leafColor: 0x2e8b57,
        leafStrategy: new DefaultLeafStrategy()
    }
};

interface BranchData {
    start: THREE.Vector3;
    end: THREE.Vector3;
    radius: number;
    level: number;
}

interface LeafData {
    pos: THREE.Vector3;
    dir: THREE.Vector3;
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

        let axiom = "X";
        for (let i = 0; i < params.iterations; i++) {
            axiom = this.expand(params, axiom, i);
        }

        this.interpret(axiom, params);
    }

    private expand(params: TreeParams, input: string, currentLevel: number): string {
        const isLast = currentLevel === params.iterations - 1;

        let result = "";
        for (const char of input) {
            if (char === 'X') {
                if (isLast) {
                    result += "L";
                    continue;
                }
                // Prune only allowed after enough iterations
                const roll = Math.random();
                const canPrune = currentLevel >= params.minExpansionLevel;
                if (roll < 0.6) result += "F[&X]/[&X]/[&X]";
                else if (roll < 0.9 || !canPrune) result += "F[&X]/[&X]";
                else result += "L";
            } else {
                result += char;
            }
        }
        return result;
    }

    private interpret(instructions: string, params: TreeParams) {
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

                    if (params.gravity !== 0) {
                        const pullDir = params.gravity > 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
                        const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pullDir);
                        currQuat.slerp(targetQuat, Math.abs(params.gravity) * (level + 1) * 0.2);
                    }

                    const endPos = currPos.clone().add(dir.multiplyScalar(length));
                    this.branches.push({ start: currPos.clone(), end: endPos.clone(), radius: currThick, level });

                    if (symbol === 'L') {
                        this.leaves.push({ pos: endPos.clone(), dir: dir.clone() });
                    }
                    currPos.copy(endPos);
                    break;
                }
                case '[':
                    stack.push({ pos: currPos.clone(), quat: currQuat.clone(), thick: currThick, level });
                    level++;
                    currThick *= params.thicknessDecay;
                    break;
                case ']':
                    const prev = stack.pop()!;
                    currPos.copy(prev.pos);
                    currQuat.copy(prev.quat);
                    currThick = prev.thick;
                    level = prev.level;
                    break;
                case '&': {
                    const pitchAngle = params.spread + (Math.random() - 0.5) * params.jitter;
                    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchAngle);
                    currQuat.multiply(pitch);
                    break;
                }
                case '/': {
                    const yawAngle = ((Math.PI * 2) / 3) + (Math.random() - 0.5) * params.jitter;
                    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
                    currQuat.multiply(yaw);
                    break;
                }
            }
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
        const woodGeos: THREE.BufferGeometry[] = [];
        const leafGeos: THREE.BufferGeometry[] = [];

        for (const branch of tree.branches) {
            const height = branch.start.distanceTo(branch.end);
            const geo = new THREE.CylinderGeometry(branch.radius * 0.7, branch.radius, height, 6);

            const midpoint = new THREE.Vector3().addVectors(branch.start, branch.end).multiplyScalar(0.5);
            const direction = new THREE.Vector3().subVectors(branch.end, branch.start).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

            const matrix = new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1));
            geo.applyMatrix4(matrix);
            woodGeos.push(geo);
        }

        for (const leaf of tree.leaves) {
            params.leafStrategy.addLeaves(leafGeos, leaf, params);
        }

        const mergedWood = this.mergeGeometries(woodGeos, `LSystemWood_${kind}_${variation}`);
        const mergedLeaves = this.mergeGeometries(leafGeos, `LSystemLeaves_${kind}_${variation}`);

        woodGeos.forEach(g => g.dispose());
        leafGeos.forEach(g => g.dispose());

        return { woodGeo: mergedWood, leafGeo: mergedLeaves, kind, variation };
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
