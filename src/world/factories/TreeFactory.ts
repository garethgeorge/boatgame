import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

interface TreeArchetype {
    woodGeo: THREE.BufferGeometry;
    leafGeo: THREE.BufferGeometry;
    wetness: number;
}

export class TreeFactory implements DecorationFactory {
    private static readonly woodMaterial = new THREE.MeshToonMaterial({ color: 0x8B4513, name: 'Tree - Wood Material' }); // Brown
    private static readonly leafMaterial = new THREE.MeshToonMaterial({ color: 0xffffff, name: 'Tree - Leaf Material' }); // White (for vertex coloring/instancing)

    private static readonly DEFAULT_LEAF_COLOR = new THREE.Color(0x228B22); // Forest Green
    private static readonly SNOWY_LEAF_COLOR = new THREE.Color(0xFFFFFF); // White

    private archetypes: TreeArchetype[] = [];

    async load(): Promise<void> {
        GraphicsUtils.registerObject(TreeFactory.woodMaterial);
        GraphicsUtils.registerObject(TreeFactory.leafMaterial);

        // Clear existing archetypes
        this.archetypes.forEach(a => {
            GraphicsUtils.disposeObject(a.woodGeo);
            GraphicsUtils.disposeObject(a.leafGeo);
        });
        this.archetypes = [];

        console.log("Generating Tree Archetypes...");

        // Generate a set of archetypes with varying wetness
        for (let i = 0; i < 30; i++) {
            const wetness = i / 30;
            const archetype = this.generateArchetype(wetness);
            this.archetypes.push(archetype);
        }
    }

    private generateArchetype(wetness: number): TreeArchetype {
        const woodGeos: THREE.BufferGeometry[] = [];
        const leafGeos: THREE.BufferGeometry[] = [];

        // Parameters based on wetness
        const height = 4 + wetness * 4 + Math.random() * 2;
        const trunkThickness = 0.4 + wetness * 0.3;

        // 1. Trunk
        const trunkGeo = new THREE.CylinderGeometry(trunkThickness * 0.6, trunkThickness, height, 6);
        trunkGeo.translate(0, height / 2, 0);
        woodGeos.push(trunkGeo);

        // 2. Branches
        const branchCount = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < branchCount; i++) {
            const y = height * (0.4 + Math.random() * 0.5);
            const branchLen = 1.5 + Math.random() * 1.5;
            const branchThick = trunkThickness * 0.5;

            const branchGeo = new THREE.CylinderGeometry(branchThick * 0.5, branchThick, branchLen, 4);
            branchGeo.translate(0, branchLen / 2, 0);

            // Rotation and position
            const angleY = Math.random() * Math.PI * 2;
            const angleX = Math.PI / 3 + (Math.random() - 0.5) * 0.5;

            const matrix = new THREE.Matrix4().compose(
                new THREE.Vector3(0, y, 0),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angleY, angleX, 'YXZ')),
                new THREE.Vector3(1, 1, 1)
            );
            branchGeo.applyMatrix4(matrix);
            woodGeos.push(branchGeo);

            // Sub-branches
            const subBranchCount = 1 + Math.floor(Math.random() * 2);
            for (let j = 0; j < subBranchCount; j++) {
                const subLen = branchLen * (0.6 + Math.random() * 0.4);
                const subThick = branchThick * 0.7;
                const subGeo = new THREE.CylinderGeometry(subThick * 0.5, subThick, subLen, 4);
                subGeo.translate(0, subLen / 2, 0);

                const posAlong = (0.6 + Math.random() * 0.4) * branchLen;
                const subMatrix = new THREE.Matrix4().compose(
                    new THREE.Vector3(0, posAlong, 0),
                    new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 1.5, 0, Math.PI / 4 * (Math.random() > 0.5 ? 1 : -1))),
                    new THREE.Vector3(1, 1, 1)
                );
                // Sub-branch is relative to parent branch
                subGeo.applyMatrix4(subMatrix);
                subGeo.applyMatrix4(matrix); // Apply parent branch transform
                woodGeos.push(subGeo);

                // Leaf Cluster at end of sub-branch
                const leafSize = 1.0 + wetness * 0.5;
                const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
                const leafMatrix = new THREE.Matrix4().compose(
                    new THREE.Vector3(0, subLen, 0),
                    new THREE.Quaternion(),
                    new THREE.Vector3(1, 1, 1)
                );
                leafGeo.applyMatrix4(leafMatrix);
                leafGeo.applyMatrix4(subMatrix);
                leafGeo.applyMatrix4(matrix);
                leafGeos.push(leafGeo);
            }

            // Leaf Cluster at end of main branch
            const mainLeafSize = 1.2 + wetness * 0.6;
            const mainLeafGeo = new THREE.IcosahedronGeometry(mainLeafSize, 0);
            const mainLeafMatrix = new THREE.Matrix4().compose(
                new THREE.Vector3(0, branchLen, 0),
                new THREE.Quaternion(),
                new THREE.Vector3(1, 1, 1)
            );
            mainLeafGeo.applyMatrix4(mainLeafMatrix);
            mainLeafGeo.applyMatrix4(matrix);
            leafGeos.push(mainLeafGeo);
        }

        // 3. Top Leaf Cluster
        const topLeafSize = 1.5 + wetness * 0.8;
        const topLeafGeo = new THREE.IcosahedronGeometry(topLeafSize, 0);
        topLeafGeo.translate(0, height, 0);
        leafGeos.push(topLeafGeo);

        // Merge Wood
        const mergedWood = BufferGeometryUtils.mergeGeometries(woodGeos);
        mergedWood.name = `Tree - Wood Archetype ${wetness.toFixed(2)}`;
        GraphicsUtils.registerObject(mergedWood);
        woodGeos.forEach(g => g.dispose());

        // Merge Leaves
        const mergedLeaves = BufferGeometryUtils.mergeGeometries(leafGeos);
        mergedLeaves.name = `Tree - Leaf Archetype ${wetness.toFixed(2)}`;
        GraphicsUtils.registerObject(mergedLeaves);
        leafGeos.forEach(g => g.dispose());

        return { woodGeo: mergedWood, leafGeo: mergedLeaves, wetness };
    }

    createInstance(options: { wetness: number, isSnowy?: boolean, isLeafless?: boolean }): DecorationInstance[] {
        const { wetness, isSnowy = false, isLeafless = false } = options;

        // Find closest archetype
        let bestArchetype = this.archetypes[0];
        let minDist = Infinity;
        for (const archetype of this.archetypes) {
            const dist = Math.abs(archetype.wetness - wetness);
            if (dist < minDist) {
                minDist = dist;
                bestArchetype = archetype;
            }
        }

        const instances: DecorationInstance[] = [];

        // Wood Instance
        instances.push({
            geometry: bestArchetype.woodGeo,
            material: TreeFactory.woodMaterial,
            matrix: new THREE.Matrix4()
        });

        // Leaf Instance
        if (!isLeafless) {
            instances.push({
                geometry: bestArchetype.leafGeo,
                material: TreeFactory.leafMaterial,
                matrix: new THREE.Matrix4(),
                color: isSnowy ? TreeFactory.SNOWY_LEAF_COLOR : TreeFactory.DEFAULT_LEAF_COLOR
            });
        }

        return instances;
    }

    create(options: { wetness: number, isSnowy?: boolean, isLeafless?: boolean }): THREE.Group {
        const instances = this.createInstance(options);
        const group = new THREE.Group();
        for (const instance of instances) {
            const mesh = GraphicsUtils.createMesh(instance.geometry, instance.material);
            if (instance.color) {
                (mesh.material as THREE.MeshToonMaterial).color.copy(instance.color);
            }
            group.add(mesh);
        }
        return group;
    }
}
