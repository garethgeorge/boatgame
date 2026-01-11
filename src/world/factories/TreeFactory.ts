import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export type TreeKind = 'round' | 'weeping' | 'spreading';

interface TreeArchetype {
    woodGeo: THREE.BufferGeometry;
    leafGeo: THREE.BufferGeometry;
    wetness: number;
}

interface TreeParams {
    readonly symmetry: number;   // 0 to 1
    readonly openness: number;   // 0 to 1
    readonly trunk: {
        readonly heightRange: [number, number]; // [height_at_wetness_0, height_at_wetness_1]
        readonly heightRandom: number;          // additional random height
        readonly thicknessBaseRatio: number;    // multiple of height
        readonly thicknessEndRatio: number;     // multiple of height
    };
    readonly mainBranch: {
        readonly countRange: [number, number];
        readonly minEndCount: number;
        readonly minPosRatio: number;           // lowest point on trunk (0 to 1)
        readonly lengthRangeRatio: [number, number]; // multiple of trunk height
        readonly thicknessBaseRatio: number;    // multiple of trunk thickness
        readonly thicknessEndRatio: number;     // multiple of trunk thickness
        readonly angleDeg: number;              // vertical angle from trunk
        readonly angleVarDeg: number;           // allowed variation
    };
    readonly subBranch: {
        readonly countRange: [number, number];
        readonly minEndCount: number;
        readonly minPosRatio: number;           // lowest point on branch (0 to 1)
        readonly lengthRangeRatio: [number, number]; // multiple of parent branch length
        readonly thicknessBaseRatio: number;    // multiple of parent branch thickness
        readonly thicknessEndRatio: number;     // multiple of parent branch thickness
        readonly angleDeg: number;              // angle from parent branch
        readonly angleVarDeg: number;           // allowed variation
        readonly upwardAngleRangeDeg: [number, number]; // absolute "ground-up" angle constraints
    };
}

interface TreeConfig {
    readonly kind: TreeKind;
    readonly params: TreeParams;
    addLeaves(leafGeos: THREE.BufferGeometry[], matrix: THREE.Matrix4, length: number, wetness: number, openness: number): void;
    getLeafColor(isSnowy: boolean): THREE.Color;
}

class RoundTreeConfig implements TreeConfig {
    readonly kind: TreeKind = 'round';
    readonly params: TreeParams = {
        symmetry: 0.8,
        openness: 0.3,
        trunk: {
            heightRange: [4, 8],
            heightRandom: 2,
            thicknessBaseRatio: 0.08,
            thicknessEndRatio: 0.05,
        },
        mainBranch: {
            countRange: [4, 6],
            minEndCount: 2,
            minPosRatio: 0.5,
            lengthRangeRatio: [0.3, 0.5],
            thicknessBaseRatio: 0.7,
            thicknessEndRatio: 0.4,
            angleDeg: 60,
            angleVarDeg: 15,
        },
        subBranch: {
            countRange: [2, 4],
            minEndCount: 1,
            minPosRatio: 0.5,
            lengthRangeRatio: [0.2, 0.4],
            thicknessBaseRatio: 0.7,
            thicknessEndRatio: 0.4,
            angleDeg: 60,
            angleVarDeg: 15,
            upwardAngleRangeDeg: [-20, 20],
        }
    };

    addLeaves(leafGeos: THREE.BufferGeometry[], matrix: THREE.Matrix4, length: number, wetness: number, openness: number): void {
        const leafSize = (1.6 + wetness * 0.6) * (1 - openness * 0.5);
        const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
        leafGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, length, 0));
        leafGeo.applyMatrix4(matrix);
        GraphicsUtils.addVertexColors(leafGeo, new THREE.Color(1, 1, 1));
        leafGeos.push(leafGeo);
    }

    getLeafColor(isSnowy: boolean): THREE.Color {
        return isSnowy ? new THREE.Color(0xFFFFFF) : new THREE.Color(0x228B22);
    }
}

class SpreadingTreeConfig implements TreeConfig {
    readonly kind: TreeKind = 'spreading';
    readonly params: TreeParams = {
        symmetry: 0.9,
        openness: 0.2,
        trunk: {
            heightRange: [6, 12],
            heightRandom: 3,
            thicknessBaseRatio: 0.09,
            thicknessEndRatio: 0.07,
        },
        mainBranch: {
            countRange: [5, 7],
            minEndCount: 1,
            minPosRatio: 0.7,
            lengthRangeRatio: [0.5, 0.7],
            thicknessBaseRatio: 0.7,
            thicknessEndRatio: 0.5,
            angleDeg: 75,
            angleVarDeg: 12,
        },
        subBranch: {
            countRange: [2, 5],
            minEndCount: 1,
            minPosRatio: 0.7,
            lengthRangeRatio: [0.5, 0.8],
            thicknessBaseRatio: 0.8,
            thicknessEndRatio: 0.4,
            angleDeg: 30,
            angleVarDeg: 12,
            upwardAngleRangeDeg: [15, 30],
        }
    };

    addLeaves(leafGeos: THREE.BufferGeometry[], matrix: THREE.Matrix4, length: number, wetness: number, openness: number): void {
        const addCluster = (pos: number, size: number, flat: number) => {
            const leafGeo = new THREE.IcosahedronGeometry(size, 0);
            leafGeo.scale(1.3, flat, 1.3);
            leafGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, pos, 0));
            leafGeo.applyMatrix4(matrix);
            GraphicsUtils.addVertexColors(leafGeo, new THREE.Color(1, 1, 1));
            leafGeos.push(leafGeo);
        };

        const opennessFactor = Math.pow(1 - openness, 0.7);
        const leafSizeBase = (1.4 + wetness * 0.8) * (0.05 + 0.95 * opennessFactor);
        if (leafSizeBase < 0.1) return;

        addCluster(length, leafSizeBase * 1.2, 0.6);

        if (openness < 0.8) {
            const extraClusters = Math.floor((1 - openness) * 3);
            for (let i = 0; i < extraClusters; i++) {
                const posAlong = (0.4 + 0.4 * (i / extraClusters)) * length;
                addCluster(posAlong, leafSizeBase * 0.9, 0.5);
            }
        }
    }

    getLeafColor(isSnowy: boolean): THREE.Color {
        return isSnowy ? new THREE.Color(0xFFFFFF) : new THREE.Color(0x3ea043);
    }
}

class WillowTreeConfig implements TreeConfig {
    readonly kind: TreeKind = 'weeping';
    readonly params: TreeParams = {
        symmetry: 0.1,
        openness: 0.2,
        trunk: {
            heightRange: [5, 10],
            heightRandom: 3,
            thicknessBaseRatio: 0.08,
            thicknessEndRatio: 0.05,
        },
        mainBranch: {
            countRange: [5, 8],
            minEndCount: 3,
            minPosRatio: 0.6,
            lengthRangeRatio: [0.4, 0.7],
            thicknessBaseRatio: 0.6,
            thicknessEndRatio: 0.3,
            angleDeg: 45,
            angleVarDeg: 20,
        },
        subBranch: {
            countRange: [4, 6],
            minEndCount: 1,
            minPosRatio: 0.3,
            lengthRangeRatio: [0.5, 0.7],
            thicknessBaseRatio: 0.7,
            thicknessEndRatio: 0.5,
            angleDeg: 45,
            angleVarDeg: 25,
            upwardAngleRangeDeg: [-30, 0],
        }
    };

    addLeaves(leafGeos: THREE.BufferGeometry[], matrix: THREE.Matrix4, length: number, wetness: number, openness: number): void {
        const strandCount = Math.floor((4 + Math.random() * 4) * (1 - openness * 0.5));

        // Target height above ground for strands to reach
        const targetGroundClearance = 4.0;

        for (let i = 0; i < strandCount; i++) {
            const isTerminal = i === strandCount - 1;
            const posAlong = isTerminal ? length : (0.5 + 0.5 * Math.random()) * length;

            // Calculate attachment point in world (tree-local) space
            const worldAttachPoint = new THREE.Vector3(0, posAlong, 0).applyMatrix4(matrix);

            // Determine strand length so it reaches target clearance
            // We use worldAttachPoint.y as the most accurate height
            let sLen = Math.max(1.0, worldAttachPoint.y);

            // Add variation and limit max length
            sLen = Math.min(sLen, 10.0) * (0.9 + Math.random() * 0.1) - targetGroundClearance;

            const sWidth = 0.3 + Math.random() * 0.2;
            const strandGeo = new THREE.BoxGeometry(sWidth, sLen, sWidth / 2, 1, 16, 1);
            strandGeo.translate(0, sLen / 2, 0);

            this.applyWillowStrandDroop(strandGeo, sLen);

            const radialDir = new THREE.Vector3(worldAttachPoint.x, 0, worldAttachPoint.z).normalize();
            const baseAngle = Math.atan2(radialDir.x, radialDir.z);
            const jitter = (Math.random() - 0.5) * 0.4;

            const strandMatrix = new THREE.Matrix4().compose(
                worldAttachPoint,
                new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, baseAngle + jitter, 0, 'YXZ')),
                new THREE.Vector3(1, 1, 1)
            );

            strandGeo.applyMatrix4(strandMatrix);

            // Add jittered vertex colors with slight hue shift
            const rv = 0.85 + Math.random() * 0.3;
            const gv = 0.85 + Math.random() * 0.3;
            const bv = 0.85 + Math.random() * 0.3;
            GraphicsUtils.addVertexColors(strandGeo, new THREE.Color(rv, gv, bv));

            leafGeos.push(strandGeo);
        }
    }

    private applyWillowStrandDroop(geo: THREE.BufferGeometry, length: number) {
        const positions = geo.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            v.fromBufferAttribute(positions, i);
            const ratio = v.y / length;
            const outward = Math.sin(Math.min(ratio * 2.0, 1.0) * Math.PI * 0.5) * (length * 0.35);
            const upPart = -Math.sin(ratio * Math.PI * 0.6) * 1.0;
            const downPart = Math.pow(ratio, 2.0) * (length * 2.5);
            v.z += upPart + downPart;
            v.y = outward;
            const taper = 1.0 - ratio * 0.25;
            v.x *= taper;
            positions.setXYZ(i, v.x, v.y, v.z);
        }
        positions.needsUpdate = true;
        geo.computeVertexNormals();
    }

    getLeafColor(isSnowy: boolean): THREE.Color {
        return isSnowy ? new THREE.Color(0xFFFFFF) : new THREE.Color(0x41b98d);
    }
}

export class TreeFactory implements DecorationFactory {
    private static readonly woodMaterial = new THREE.MeshToonMaterial({ color: 0x8B4513, name: 'Tree - Wood Material' }); // Brown
    private static readonly leafMaterial = new THREE.MeshToonMaterial({ color: 0xffffff, name: 'Tree - Leaf Material', side: THREE.DoubleSide, vertexColors: true }); // White

    private archetypes: Map<TreeKind, TreeArchetype[]> = new Map();

    async load(): Promise<void> {
        GraphicsUtils.registerObject(TreeFactory.woodMaterial);
        GraphicsUtils.registerObject(TreeFactory.leafMaterial);

        // Clear existing archetypes
        this.archetypes.forEach(list => {
            list.forEach(a => {
                GraphicsUtils.disposeObject(a.woodGeo);
                GraphicsUtils.disposeObject(a.leafGeo);
            });
        });
        this.archetypes.clear();

        console.log("Generating Tree Archetypes...");

        const configs: TreeConfig[] = [
            new RoundTreeConfig(),
            new WillowTreeConfig(),
            new SpreadingTreeConfig()
        ];
        for (const config of configs) {
            const list: TreeArchetype[] = [];
            for (let i = 0; i < 20; i++) {
                const wetness = i / 20;
                list.push(this.generateArchetype(wetness, config));
            }
            this.archetypes.set(config.kind, list);
        }
    }

    private generateArchetype(wetness: number, config: TreeConfig): TreeArchetype {
        const p = config.params;
        const woodGeos: THREE.BufferGeometry[] = [];
        const leafGeos: THREE.BufferGeometry[] = [];

        // 1. Trunk
        const height = THREE.MathUtils.lerp(p.trunk.heightRange[0], p.trunk.heightRange[1], wetness) + Math.random() * p.trunk.heightRandom;
        const baseThick = height * p.trunk.thicknessBaseRatio;
        const endThick = height * p.trunk.thicknessEndRatio;

        woodGeos.push(this.createTrunkGeo(height, baseThick, endThick));

        // 2. Branches
        this.generateBranches(config, height, endThick, woodGeos, leafGeos, wetness);

        // Merge and Cleanup
        const mergedWood = this.mergeGeometries(woodGeos, `Tree - Wood Archetype ${config.kind} ${wetness.toFixed(2)}`);
        const mergedLeaves = this.mergeGeometries(leafGeos, `Tree - Leaf Archetype ${config.kind} ${wetness.toFixed(2)}`);

        woodGeos.forEach(g => g.dispose());
        leafGeos.forEach(g => g.dispose());

        return { woodGeo: mergedWood, leafGeo: mergedLeaves, wetness };
    }

    private createTrunkGeo(height: number, baseThick: number, endThick: number): THREE.BufferGeometry {
        const trunkGeo = new THREE.CylinderGeometry(endThick, baseThick, height, 6);
        trunkGeo.translate(0, height / 2, 0);
        return trunkGeo;
    }

    /**
     * Generates all main branches for a tree archetype.
     * Branches are split into two groups: 
     * 1. Top branches: explicitly attached to the very tip of the trunk.
     * 2. Side branches: placed along the trunk in pairs with interpolated symmetry.
     */
    private generateBranches(config: TreeConfig, trunkHeight: number, trunkEndThick: number, woodGeos: THREE.BufferGeometry[], leafGeos: THREE.BufferGeometry[], wetness: number) {
        const p = config.params;
        const branchCount = Math.floor(THREE.MathUtils.lerp(p.mainBranch.countRange[0], p.mainBranch.countRange[1], Math.random()));

        // 1. Top branches - These all share the max trunk height
        for (let i = 0; i < p.mainBranch.minEndCount; i++) {
            const branchData = this.calculateMainBranchPlacement(p, trunkHeight, i, branchCount, true);
            this.createMainBranch(config, branchData.y, branchData.angleY, branchData.angleX, trunkHeight, trunkEndThick, woodGeos, leafGeos, wetness);
        }

        // 2. Remaining branches in pairs
        const remaining = branchCount - p.mainBranch.minEndCount;
        for (let i = 0; i < remaining; i += 2) {
            const idx = p.mainBranch.minEndCount + i;

            // First branch of pair: placed randomly within height constraints
            const branchA = this.calculateMainBranchPlacement(p, trunkHeight, idx, branchCount, false);
            this.createMainBranch(config, branchA.y, branchA.angleY, branchA.angleX, trunkHeight, trunkEndThick, woodGeos, leafGeos, wetness);

            if (i + 1 < remaining) {
                // Second branch: calculated by interpolating between a fresh random placement
                // and a perfectly symmetric (mirrored) version of Branch A.
                const randomB = this.calculateMainBranchPlacement(p, trunkHeight, idx + 1, branchCount, false);
                const symmetricB = {
                    y: branchA.y,
                    angleY: branchA.angleY + Math.PI,
                    angleX: branchA.angleX
                };

                const weight = p.symmetry;
                const finalY = THREE.MathUtils.lerp(randomB.y, symmetricB.y, weight);
                const finalAngleY = this.lerpAngle(randomB.angleY, symmetricB.angleY, weight);
                const finalAngleX = THREE.MathUtils.lerp(randomB.angleX, symmetricB.angleX, weight);

                this.createMainBranch(config, finalY, finalAngleY, finalAngleX, trunkHeight, trunkEndThick, woodGeos, leafGeos, wetness);
            }
        }
    }

    /**
     * Calculates the position (y) and rotation (angleY, angleX) for a main branch.
     * - angleY: Radial rotation around the trunk (0 to 2PI).
     * - angleX: Tilt away from the trunk's vertical axis (e.g., 90deg is horizontal).
     */
    private calculateMainBranchPlacement(p: TreeParams, height: number, index: number, total: number, isTop: boolean) {
        if (isTop) {
            return {
                y: height,
                angleY: (index / p.mainBranch.minEndCount) * Math.PI * 2,
                // Top branches use the full angleDeg (e.g., 90deg for horizontal)
                angleX: (Math.PI / 180) * (p.mainBranch.angleDeg + (Math.random() - 0.5) * p.mainBranch.angleVarDeg)
            };
        }

        const availableHeight = height * (1 - p.mainBranch.minPosRatio);
        const y = height * p.mainBranch.minPosRatio + Math.random() * availableHeight;

        return {
            y,
            angleY: Math.random() * Math.PI * 2,
            angleX: (Math.PI / 180) * (p.mainBranch.angleDeg + (Math.random() - 0.5) * p.mainBranch.angleVarDeg * 2)
        };
    }

    /**
     * Creates the geometry for a single main branch and adds it to the list.
     * The branch is modeled as a cylinder pointing up (+Y), then rotated out from the trunk.
     */
    private createMainBranch(config: TreeConfig, y: number, angleY: number, angleX: number, trunkHeight: number, trunkEndThick: number, woodGeos: THREE.BufferGeometry[], leafGeos: THREE.BufferGeometry[], wetness: number) {
        const p = config.params;
        const branchLen = trunkHeight * THREE.MathUtils.lerp(p.mainBranch.lengthRangeRatio[0], p.mainBranch.lengthRangeRatio[1], Math.random());
        const bBaseThick = trunkEndThick * p.mainBranch.thicknessBaseRatio;
        const bEndThick = trunkEndThick * p.mainBranch.thicknessEndRatio;

        // 1. Create cylinder geometry (base at origin, extending up the Y axis)
        const branchGeo = new THREE.CylinderGeometry(bEndThick, bBaseThick, branchLen, 4);
        branchGeo.translate(0, branchLen / 2, 0);

        // 2. Composite Transformation:
        // - Rotate around X by angleX: tilts the branch out from the vertical center.
        // - Rotate around Y by angleY: spins the tilted branch around the trunk.
        // - Translate by y: moves the base to the desired height on the trunk.
        // Uses 'YXZ' order: Y(radial) -> X(tilt) -> Z(none).
        const matrix = new THREE.Matrix4().compose(
            new THREE.Vector3(0, y, 0),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angleY, angleX, 'YXZ')),
            new THREE.Vector3(1, 1, 1)
        );
        branchGeo.applyMatrix4(matrix);
        woodGeos.push(branchGeo);

        // 3. Chain into sub-branch generation
        this.generateSubBranches(config, branchLen, bEndThick, matrix, woodGeos, leafGeos, wetness);
    }

    private generateSubBranches(config: TreeConfig, branchLen: number, branchEndThick: number, parentMatrix: THREE.Matrix4, woodGeos: THREE.BufferGeometry[], leafGeos: THREE.BufferGeometry[], wetness: number) {
        const p = config.params;
        const subCount = Math.floor(THREE.MathUtils.lerp(p.subBranch.countRange[0], p.subBranch.countRange[1], Math.random()));

        // 1. Tip branches
        for (let j = 0; j < p.subBranch.minEndCount; j++) {
            const placement = this.calculateSubBranchPlacement(p, branchLen, j, subCount, true);
            this.createSubBranch(config, placement, branchLen, branchEndThick, parentMatrix, woodGeos, leafGeos, wetness);
        }

        // 2. Remaining side branches in pairs with alternating sides
        const remaining = subCount - p.subBranch.minEndCount;
        for (let j = 0; j < remaining; j += 2) {
            const pairIdx = Math.floor(j / 2);
            const sideA = pairIdx % 2 === 0 ? 1 : -1;

            // First branch of pair
            const placementA = this.calculateSubBranchPlacement(p, branchLen, j, subCount, false, sideA);
            this.createSubBranch(config, placementA, branchLen, branchEndThick, parentMatrix, woodGeos, leafGeos, wetness);

            if (j + 1 < remaining) {
                // Second branch: interpolated between random (opposite side) and symmetric
                const randomB = this.calculateSubBranchPlacement(p, branchLen, j + 1, subCount, false, -sideA);
                const symmetricB = {
                    posAlong: placementA.posAlong,
                    angle: -placementA.angle,
                    upwardAngle: placementA.upwardAngle
                };

                const weight = p.symmetry;
                const finalPlacement = {
                    posAlong: THREE.MathUtils.lerp(randomB.posAlong, symmetricB.posAlong, weight),
                    angle: this.lerpAngle(randomB.angle, symmetricB.angle, weight),
                    upwardAngle: THREE.MathUtils.lerp(randomB.upwardAngle, symmetricB.upwardAngle, weight)
                };

                this.createSubBranch(config, finalPlacement, branchLen, branchEndThick, parentMatrix, woodGeos, leafGeos, wetness);
            }
        }
    }

    private calculateSubBranchPlacement(p: TreeParams, branchLen: number, index: number, total: number, isTip: boolean, sideInput?: number) {
        // Determine position along the parent branch
        const posAlong = isTip ? branchLen : (p.subBranch.minPosRatio + Math.random() * (0.95 - p.subBranch.minPosRatio)) * branchLen;

        // Angle between the sub-branch and the parent branch (tilt)
        const side = sideInput !== undefined ? sideInput : (Math.random() > 0.5 ? 1 : -1);
        const angle = side * (p.subBranch.angleDeg + (Math.random() - 0.5) * p.subBranch.angleVarDeg) * (Math.PI / 180);

        // Upward angle for the sub-branch from the provided range
        const upwardAngle = (p.subBranch.upwardAngleRangeDeg[0] + Math.random() * (p.subBranch.upwardAngleRangeDeg[1] - p.subBranch.upwardAngleRangeDeg[0])) * (Math.PI / 180);

        return { posAlong, angle, upwardAngle };
    }

    /**
     * Creates and attaches a single sub-branch to its parent.
     */
    private createSubBranch(config: TreeConfig, placement: any, parentLen: number, branchEndThick: number, parentMatrix: THREE.Matrix4, woodGeos: THREE.BufferGeometry[], leafGeos: THREE.BufferGeometry[], wetness: number) {
        const p = config.params;

        // Scale sub-branch dimensions based on parent's dimensions and random factor
        const subLen = parentLen * THREE.MathUtils.lerp(p.subBranch.lengthRangeRatio[0], p.subBranch.lengthRangeRatio[1], Math.random());
        const subBaseThick = branchEndThick * p.subBranch.thicknessBaseRatio;
        const subEndThick = branchEndThick * p.subBranch.thicknessEndRatio;

        // 1. Create cylinder geometry (base at origin, extending along +Y)
        const subGeo = new THREE.CylinderGeometry(subEndThick, subBaseThick, subLen, 4);
        subGeo.translate(0, subLen / 2, 0);

        // 2. Transformations:
        // - Rotate about Z by 'angle' (tilt from parent)
        // - Rotate about Y by 'upwardAngle' (vertical lift)
        // - Translate to position on parent branch (along parent's Y axis)
        // - Lastly apply parent matrix
        // Order 'YXZ' ensures Z rotation then X rotation.
        const a = -Math.PI / 4;
        const localMatrix = new THREE.Matrix4().compose(
            new THREE.Vector3(0, placement.posAlong, 0),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(placement.angle, 0, -placement.upwardAngle, 'ZXY')),
            new THREE.Vector3(1, 1, 1)
        );

        const finalMatrix = parentMatrix.clone().multiply(localMatrix);
        subGeo.applyMatrix4(finalMatrix);
        woodGeos.push(subGeo);

        // 3. Add leaves to the sub-branch
        config.addLeaves(leafGeos, finalMatrix, subLen, wetness, p.openness);
    }

    private mergeGeometries(geos: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
        const merged = geos.length > 0 ? BufferGeometryUtils.mergeGeometries(geos) : new THREE.BufferGeometry();
        merged.name = name;
        GraphicsUtils.registerObject(merged);
        return merged;
    }

    private lerpAngle(a: number, b: number, t: number): number {
        let delta = b - a;
        while (delta < -Math.PI) delta += Math.PI * 2;
        while (delta > Math.PI) delta -= Math.PI * 2;
        return a + delta * t;
    }

    createInstance(options: { wetness: number, kind?: TreeKind, isSnowy?: boolean, isLeafless?: boolean }): DecorationInstance[] {
        const { wetness, kind = 'round', isSnowy = false, isLeafless = false } = options;

        const archetypeList = this.archetypes.get(kind) || this.archetypes.get('round')!;
        const configForKind = (kind: TreeKind) => {
            switch (kind) {
                case 'weeping': return new WillowTreeConfig();
                case 'spreading': return new SpreadingTreeConfig();
                default: return new RoundTreeConfig();
            }
        };
        const config = configForKind(kind);

        let bestArchetype = archetypeList[0];
        let minDist = Infinity;
        for (const archetype of archetypeList) {
            const dist = Math.abs(archetype.wetness - wetness);
            if (dist < minDist) {
                minDist = dist;
                bestArchetype = archetype;
            }
        }

        const instances: DecorationInstance[] = [];

        instances.push({
            geometry: bestArchetype.woodGeo,
            material: TreeFactory.woodMaterial,
            matrix: new THREE.Matrix4()
        });

        if (!isLeafless) {
            instances.push({
                geometry: bestArchetype.leafGeo,
                material: TreeFactory.leafMaterial,
                matrix: new THREE.Matrix4(),
                color: config.getLeafColor(isSnowy)
            });
        }

        return instances;
    }

    create(options: { wetness: number, kind?: TreeKind, isSnowy?: boolean, isLeafless?: boolean }): THREE.Group {
        const instances = this.createInstance(options);
        const group = new THREE.Group();
        for (const instance of instances) {
            // Clone material if we have a specific color to apply, since materials are shared
            let material = instance.material;
            if (instance.color) {
                material = material.clone();
                (material as THREE.MeshToonMaterial).color.copy(instance.color);
            }
            const mesh = GraphicsUtils.createMesh(instance.geometry, material);
            group.add(mesh);
        }
        return group;
    }
}
