import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export type TreeKind = 'default' | 'willow';

interface TreeArchetype {
    woodGeo: THREE.BufferGeometry;
    leafGeo: THREE.BufferGeometry;
    wetness: number;
}

interface TreeConfig {
    readonly kind: TreeKind;
    getHeight(wetness: number): number;
    getTrunkThickness(wetness: number): number;
    getTrunkTaper(): number;
    getBranchCount(): number;
    getBranchY(height: number, index: number, totalCount: number): number;
    getBranchLength(): number;
    getBranchThickness(trunkThickness: number): number;
    getBranchAngleY(index: number, count: number): number;
    getBranchAngleX(): number;
    getSubBranchCount(): number;
    getSubBranchLength(branchLen: number): number;
    getSubBranchThickness(branchThick: number): number;
    getSubBranchPosAlong(branchLen: number): number;
    getSubBranchEuler(): THREE.Euler;
    addLeaves(leafGeos: THREE.BufferGeometry[], matrix: THREE.Matrix4, length: number, wetness: number): void;
    addTopLeaves(leafGeos: THREE.BufferGeometry[], height: number, wetness: number): void;
    getLeafColor(isSnowy: boolean): THREE.Color;
}

class DefaultTreeConfig implements TreeConfig {
    readonly kind: TreeKind = 'default';

    getHeight(wetness: number): number {
        return 4 + wetness * 4 + Math.random() * 2;
    }

    getTrunkThickness(wetness: number): number {
        return 0.4 + wetness * 0.3;
    }

    getTrunkTaper(): number {
        return 0.6;
    }

    getBranchCount(): number {
        return 4 + Math.floor(Math.random() * 3);
    }

    getBranchY(height: number, index: number, totalCount: number): number {
        return height * (0.4 + Math.random() * 0.5);
    }

    getBranchLength(): number {
        return 1.5 + Math.random() * 1.5;
    }

    getBranchThickness(trunkThickness: number): number {
        return trunkThickness * 0.5;
    }

    getBranchAngleY(index: number, count: number): number {
        return Math.random() * Math.PI * 2;
    }

    getBranchAngleX(): number {
        return Math.PI / 3 + (Math.random() - 0.5) * 0.5;
    }

    getSubBranchCount(): number {
        return 1 + Math.floor(Math.random() * 2);
    }

    getSubBranchLength(branchLen: number): number {
        return branchLen * (0.6 + Math.random() * 0.4);
    }

    getSubBranchThickness(branchThick: number): number {
        return branchThick * 0.7;
    }

    getSubBranchPosAlong(branchLen: number): number {
        return (0.6 + Math.random() * 0.4) * branchLen;
    }

    getSubBranchEuler(): THREE.Euler {
        return new THREE.Euler((Math.random() - 0.5) * 1.5, 0, Math.PI / 4 * (Math.random() > 0.5 ? 1 : -1));
    }

    addLeaves(leafGeos: THREE.BufferGeometry[], matrix: THREE.Matrix4, length: number, wetness: number): void {
        const leafSize = 1.2 + wetness * 0.6;
        const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
        leafGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, length, 0));
        leafGeo.applyMatrix4(matrix);
        GraphicsUtils.addVertexColors(leafGeo, new THREE.Color(1, 1, 1));
        leafGeos.push(leafGeo);
    }

    addTopLeaves(leafGeos: THREE.BufferGeometry[], height: number, wetness: number): void {
        const topLeafSize = 1.5 + wetness * 0.8;
        const topLeafGeo = new THREE.IcosahedronGeometry(topLeafSize, 0);
        topLeafGeo.translate(0, height, 0);
        GraphicsUtils.addVertexColors(topLeafGeo, new THREE.Color(1, 1, 1));
        leafGeos.push(topLeafGeo);
    }

    getLeafColor(isSnowy: boolean): THREE.Color {
        return isSnowy ? new THREE.Color(0xFFFFFF) : new THREE.Color(0x228B22);
    }
}

class WillowTreeConfig implements TreeConfig {
    readonly kind: TreeKind = 'willow';

    getHeight(wetness: number): number {
        return 5 + wetness * 3 + Math.random() * 2;
    }

    getTrunkThickness(wetness: number): number {
        return 0.5 + wetness * 0.4;
    }

    getTrunkTaper(): number {
        return 0.7;
    }

    getBranchCount(): number {
        return 5 + Math.floor(Math.random() * 3);
    }

    getBranchY(height: number, index: number, totalCount: number): number {
        // Ensure first 3 branches are at the absolute top
        if (index < 3) return height * 0.98;
        // Remaining branches distributed lower down
        return height * (0.6 + Math.random() * 0.35);
    }

    getBranchLength(): number {
        return 2.5 + Math.random() * 2.5;
    }

    getBranchThickness(trunkThickness: number): number {
        return trunkThickness * 0.4;
    }

    getBranchAngleY(index: number, count: number): number {
        return (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    }

    getBranchAngleX(): number {
        return Math.PI / 2.5 + Math.random() * 0.3;
    }

    getSubBranchCount(): number {
        return 3 + Math.floor(Math.random() * 3);
    }

    getSubBranchLength(branchLen: number): number {
        return branchLen * (0.6 + Math.random() * 0.4);
    }

    getSubBranchThickness(branchThick: number): number {
        return branchThick * 0.7;
    }

    getSubBranchPosAlong(branchLen: number): number {
        return (0.6 + Math.random() * 0.4) * branchLen;
    }

    getSubBranchEuler(): THREE.Euler {
        return new THREE.Euler((Math.random() - 0.5) * 1.5, 0, Math.PI / 4 * (Math.random() > 0.5 ? 1 : -1));
    }

    addLeaves(leafGeos: THREE.BufferGeometry[], matrix: THREE.Matrix4, length: number, wetness: number): void {
        const strandCount = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < strandCount; i++) {
            const isTerminal = i === strandCount - 1;
            const posAlong = isTerminal ? length : (0.5 + 0.5 * Math.random()) * length;

            const sLen = 2.5 + Math.random() * 1.5;
            const sWidth = 0.3 + Math.random() * 0.2;
            const strandGeo = new THREE.BoxGeometry(sWidth, sLen, sWidth / 2, 1, 16, 1);
            strandGeo.translate(0, sLen / 2, 0);

            this.applyWillowStrandDroop(strandGeo, sLen);

            const worldAttachPoint = new THREE.Vector3(0, posAlong, 0).applyMatrix4(matrix);
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

    addTopLeaves(leafGeos: THREE.BufferGeometry[], height: number, wetness: number): void {
        // No top leaves for willow
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

        const configs: TreeConfig[] = [new DefaultTreeConfig(), new WillowTreeConfig()];
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
        const woodGeos: THREE.BufferGeometry[] = [];
        const leafGeos: THREE.BufferGeometry[] = [];

        const height = config.getHeight(wetness);
        const trunkThickness = config.getTrunkThickness(wetness);

        // 1. Trunk
        const trunkGeo = new THREE.CylinderGeometry(trunkThickness * config.getTrunkTaper(), trunkThickness, height, 6);
        trunkGeo.translate(0, height / 2, 0);
        woodGeos.push(trunkGeo);

        // 2. Branches
        const branchCount = config.getBranchCount();
        for (let i = 0; i < branchCount; i++) {
            const y = config.getBranchY(height, i, branchCount);
            const branchLen = config.getBranchLength();
            const branchThick = config.getBranchThickness(trunkThickness);

            const branchGeo = new THREE.CylinderGeometry(branchThick * 0.5, branchThick, branchLen, 4);
            branchGeo.translate(0, branchLen / 2, 0);

            // Rotation and position
            const angleY = config.getBranchAngleY(i, branchCount);
            const angleX = config.getBranchAngleX();

            const matrix = new THREE.Matrix4().compose(
                new THREE.Vector3(0, y, 0),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angleY, angleX, 'YXZ')),
                new THREE.Vector3(1, 1, 1)
            );
            branchGeo.applyMatrix4(matrix);
            woodGeos.push(branchGeo);

            // Sub-branches
            const subBranchCount = config.getSubBranchCount();
            for (let j = 0; j < subBranchCount; j++) {
                const subLen = config.getSubBranchLength(branchLen);
                const subThick = config.getSubBranchThickness(branchThick);
                const subGeo = new THREE.CylinderGeometry(subThick * 0.5, subThick, subLen, 4);
                subGeo.translate(0, subLen / 2, 0);

                const posAlong = config.getSubBranchPosAlong(branchLen);
                const subMatrix = new THREE.Matrix4().compose(
                    new THREE.Vector3(0, posAlong, 0),
                    new THREE.Quaternion().setFromEuler(config.getSubBranchEuler()),
                    new THREE.Vector3(1, 1, 1)
                );
                // Sub-branch relative to parent branch
                subGeo.applyMatrix4(subMatrix);
                subGeo.applyMatrix4(matrix); // Apply parent branch transform
                woodGeos.push(subGeo);

                // Leaves at end of sub-branch
                config.addLeaves(leafGeos, matrix.clone().multiply(subMatrix), subLen, wetness);
            }

            // Leaves at end of main branch
            config.addLeaves(leafGeos, matrix, branchLen, wetness);
        }

        // 3. Top Leaves
        config.addTopLeaves(leafGeos, height, wetness);

        // Merge Wood
        const mergedWood = BufferGeometryUtils.mergeGeometries(woodGeos);
        mergedWood.name = `Tree - Wood Archetype ${config.kind} ${wetness.toFixed(2)}`;
        GraphicsUtils.registerObject(mergedWood);
        woodGeos.forEach(g => g.dispose());

        // Merge Leaves
        const mergedLeaves = BufferGeometryUtils.mergeGeometries(leafGeos);
        mergedLeaves.name = `Tree - Leaf Archetype ${config.kind} ${wetness.toFixed(2)}`;
        GraphicsUtils.registerObject(mergedLeaves);
        leafGeos.forEach(g => g.dispose());

        return { woodGeo: mergedWood, leafGeo: mergedLeaves, wetness };
    }

    createInstance(options: { wetness: number, kind?: TreeKind, isSnowy?: boolean, isLeafless?: boolean }): DecorationInstance[] {
        const { wetness, kind = 'default', isSnowy = false, isLeafless = false } = options;

        const archetypeList = this.archetypes.get(kind) || this.archetypes.get('default')!;
        const config = (kind === 'willow' ? new WillowTreeConfig() : new DefaultTreeConfig());

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
