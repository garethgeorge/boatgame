import * as THREE from 'three';
import { DecorationFactory } from './DecorationFactory';

export class TreeFactory implements DecorationFactory {
    private static readonly treeMaterial = new THREE.MeshToonMaterial({ color: 0x8B4513 }); // Brown trunk
    private static readonly leafMaterial = new THREE.MeshToonMaterial({ color: 0x228B22 }); // Forest Green
    private static readonly snowyLeafMaterial = new THREE.MeshToonMaterial({ color: 0xFFFFFF }); // White

    // Cache stores arrays of pre-generated trees
    private cache: {
        trees: { mesh: THREE.Group, wetness: number, isSnowy: boolean, isLeafless: boolean }[];
    } = { trees: [] };

    async load(): Promise<void> {
        // Clear existing cache to prevent unlimited growth if load() is called multiple times
        this.cache.trees = [];

        // Pre-generate trees
        console.log("Generating Tree Cache...");

        // Generate Standard Trees
        for (let i = 0; i < 50; i++) {
            const wetness = Math.random();
            this.cache.trees.push({ mesh: this.createTree(wetness, false, false), wetness, isSnowy: false, isLeafless: false });
        }
        // Generate Snowy Trees
        for (let i = 0; i < 30; i++) {
            const wetness = Math.random();
            this.cache.trees.push({ mesh: this.createTree(wetness, true, false), wetness, isSnowy: true, isLeafless: false });
        }
        // Generate Leafless Trees (for Ice Biome)
        for (let i = 0; i < 20; i++) {
            const wetness = Math.random();
            this.cache.trees.push({ mesh: this.createTree(wetness, false, true), wetness, isSnowy: false, isLeafless: true });
        }
    }

    create(options: { wetness: number, isSnowy?: boolean, isLeafless?: boolean }): THREE.Group {
        const { wetness, isSnowy = false, isLeafless = false } = options;

        let mesh: THREE.Group;

        if (this.cache.trees.length > 0) {
            const candidates = this.cache.trees.filter(t => t.isSnowy === isSnowy && t.isLeafless === isLeafless && Math.abs(t.wetness - wetness) < 0.3);
            const source = candidates.length > 0
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : this.cache.trees.find(t => t.isSnowy === isSnowy && t.isLeafless === isLeafless) || this.cache.trees[0];

            mesh = source ? source.mesh.clone() : this.createTree(wetness, isSnowy, isLeafless);
        } else {
            mesh = this.createTree(wetness, isSnowy, isLeafless);
        }

        return mesh;
    }

    private createTree(wetness: number, isSnowy: boolean, isLeafless: boolean): THREE.Group {
        const group = new THREE.Group();

        // Tree parameters based on wetness
        // Taller trees: 4-8m
        const height = 4 + wetness * 4 + Math.random() * 2;
        const trunkThickness = 0.4 + wetness * 0.3;

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(trunkThickness * 0.6, trunkThickness, height, 6);
        const trunk = new THREE.Mesh(trunkGeo, TreeFactory.treeMaterial);
        trunk.position.y = height / 2;
        group.add(trunk);

        // Branches & Leaves
        const branchCount = 4 + Math.floor(Math.random() * 3);

        for (let i = 0; i < branchCount; i++) {
            const y = height * (0.4 + Math.random() * 0.5); // Start higher up

            // Branch length: 1.5m to 3.0m
            const branchLen = 1.5 + Math.random() * 1.5;
            const branchThick = trunkThickness * 0.5;

            const branchGeo = new THREE.CylinderGeometry(branchThick * 0.5, branchThick, branchLen, 4);
            const branch = new THREE.Mesh(branchGeo, TreeFactory.treeMaterial);

            // Position on trunk
            branch.position.set(0, y, 0);

            // Rotation
            const angleY = Math.random() * Math.PI * 2;
            const angleX = Math.PI / 3 + (Math.random() - 0.5) * 0.5; // Angled up/out

            branch.rotation.y = angleY;
            branch.rotation.z = angleX;

            // Shift branch so it starts at trunk surface
            branch.translateY(branchLen / 2);

            group.add(branch);

            // Sub-branches
            const subBranchCount = 1 + Math.floor(Math.random() * 2);
            for (let j = 0; j < subBranchCount; j++) {
                const subLen = branchLen * (0.6 + Math.random() * 0.4);
                const subThick = branchThick * 0.7;

                const subGeo = new THREE.CylinderGeometry(subThick * 0.5, subThick, subLen, 4);
                const subBranch = new THREE.Mesh(subGeo, TreeFactory.treeMaterial);

                // Position along parent branch
                const posAlong = (0.6 + Math.random() * 0.4) * branchLen;
                subBranch.position.set(0, posAlong - branchLen / 2, 0);

                // Rotate out
                subBranch.rotation.z = Math.PI / 4 * (Math.random() > 0.5 ? 1 : -1);
                subBranch.rotation.x = (Math.random() - 0.5) * 1.5;

                subBranch.translateY(subLen / 2);

                branch.add(subBranch);

                // Leaf Cluster at end of sub-branch
                if (!isLeafless) {
                    const leafSize = 1.0 + wetness * 0.5;
                    const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
                    const leafMesh = new THREE.Mesh(leafGeo, isSnowy ? TreeFactory.snowyLeafMaterial : TreeFactory.leafMaterial);
                    leafMesh.position.set(0, subLen / 2, 0);
                    subBranch.add(leafMesh);
                }
            }

            // Leaf Cluster at end of main branch
            if (!isLeafless) {
                const leafSize = 1.2 + wetness * 0.6;
                const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
                const leafMesh = new THREE.Mesh(leafGeo, isSnowy ? TreeFactory.snowyLeafMaterial : TreeFactory.leafMaterial);

                leafMesh.position.set(0, branchLen / 2, 0);
                branch.add(leafMesh);
            }
        }

        // Top Leaf Cluster
        if (!isLeafless) {
            const topLeafSize = 1.5 + wetness * 0.8;
            const topLeafGeo = new THREE.IcosahedronGeometry(topLeafSize, 0);
            const topLeaf = new THREE.Mesh(topLeafGeo, isSnowy ? TreeFactory.snowyLeafMaterial : TreeFactory.leafMaterial);
            topLeaf.position.y = height;
            group.add(topLeaf);
        }

        return group;
    }
}
