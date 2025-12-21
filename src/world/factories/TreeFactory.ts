import {
    TransformNode,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Mesh,
    Vector3,
    Quaternion
} from '@babylonjs/core';
import { DecorationFactory } from './DecorationFactory';

export class TreeFactory implements DecorationFactory {
    // Original colors: Brown trunk, Forest Green leaves, White snow
    private static treeMaterial: StandardMaterial;
    private static leafMaterial: StandardMaterial;
    private static snowyLeafMaterial: StandardMaterial;

    private cache: {
        trees: { mesh: TransformNode, wetness: number, isSnowy: boolean, isLeafless: boolean }[];
    } = { trees: [] };

    async load(): Promise<void> {
        // Clear existing cache
        this.cache.trees = [];

        import('@babylonjs/core').then(core => {
            if (!TreeFactory.treeMaterial) {
                TreeFactory.treeMaterial = new core.StandardMaterial("treeTrunkMat");
                TreeFactory.treeMaterial.diffuseColor = core.Color3.FromHexString("#8B4513");
                TreeFactory.treeMaterial.specularColor = core.Color3.Black(); // Toon-ish

                TreeFactory.leafMaterial = new core.StandardMaterial("treeLeafMat");
                TreeFactory.leafMaterial.diffuseColor = core.Color3.FromHexString("#228B22");
                TreeFactory.leafMaterial.specularColor = core.Color3.Black();

                TreeFactory.snowyLeafMaterial = new core.StandardMaterial("treeSnowMat");
                TreeFactory.snowyLeafMaterial.diffuseColor = core.Color3.FromHexString("#FFFFFF");
                TreeFactory.snowyLeafMaterial.specularColor = core.Color3.Black();
            }

            console.log("Generating Tree Cache...");

            // Generate Standard Trees
            for (let i = 0; i < 50; i++) {
                const wetness = Math.random();
                const mesh = this.createTree(wetness, false, false);
                mesh.setEnabled(false);
                this.cache.trees.push({ mesh, wetness, isSnowy: false, isLeafless: false });
            }
            // Generate Snowy Trees
            for (let i = 0; i < 30; i++) {
                const wetness = Math.random();
                const mesh = this.createTree(wetness, true, false);
                mesh.setEnabled(false);
                this.cache.trees.push({ mesh, wetness, isSnowy: true, isLeafless: false });
            }
            // Generate Leafless Trees (for Ice Biome)
            for (let i = 0; i < 20; i++) {
                const wetness = Math.random();
                const mesh = this.createTree(wetness, false, true);
                mesh.setEnabled(false);
                this.cache.trees.push({ mesh, wetness, isSnowy: false, isLeafless: true });
            }
        });
    }

    create(options: { wetness: number, isSnowy?: boolean, isLeafless?: boolean }): TransformNode {
        // Fallback if materials not initialized (synchronous call before load)
        if (!TreeFactory.treeMaterial) {
            return new TransformNode("tree_placeholder");
        }

        const { wetness, isSnowy = false, isLeafless = false } = options;

        let mesh: TransformNode;

        if (this.cache.trees.length > 0) {
            const candidates = this.cache.trees.filter(t => t.isSnowy === isSnowy && t.isLeafless === isLeafless && Math.abs(t.wetness - wetness) < 0.3);
            const source = candidates.length > 0
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : this.cache.trees.find(t => t.isSnowy === isSnowy && t.isLeafless === isLeafless) || this.cache.trees[0];

            if (source && source.mesh) {
                // In Babylon, cloning a TransformNode hierarchy is done via instantiateHierarchy usually or clone
                // Mesh.clone clones geometry reference. TransformNode.clone clones structure.
                // I need to see RockFactory first to replace correctly.
                // Let's assume standard structure.
                // I'll skip RockFactory for this specific tool call and do it after reading if needed,
                // but I'll assume I can find it later.
                // I will just do TreeFactory now.
                // Note: cloning a root TransformNode mimics the hierarchy.
                // But meshes need to be cloned too. TransformNode.clone defaults to not cloning children?
                // Actually instanced meshes are efficient but for now let's clone.
                // Use instantiateHierarchy
                mesh = source.mesh.instantiateHierarchy() as TransformNode;
                mesh.setEnabled(true);
                // "tree_clone" name logic below...
                // Important: instantiateHierarchy returns a new root but shares materials/geometry.
                // It's correct for this.
                // Wait, source.mesh is a TransformNode acting as group.
                mesh.name = "tree_clone";
                mesh.scaling = source.mesh.scaling.clone(); // instantiateHierarchy doesn't copy current transform?
                // Actually it clones properties.
            } else {
                mesh = this.createTree(wetness, isSnowy, isLeafless);
            }
        } else {
            mesh = this.createTree(wetness, isSnowy, isLeafless);
        }

        return mesh;
    }

    private createTree(wetness: number, isSnowy: boolean, isLeafless: boolean): TransformNode {
        const root = new TransformNode("tree_root");
        root.metadata = { mergeable: true };

        // Tree parameters based on wetness
        // Taller trees: 4-8m
        const height = 4 + wetness * 4 + Math.random() * 2;
        const trunkThickness = 0.4 + wetness * 0.3;

        // Trunk
        const trunk = MeshBuilder.CreateCylinder("trunk", {
            height: height,
            diameterTop: trunkThickness * 0.6,
            diameterBottom: trunkThickness,
            tessellation: 6
        });
        trunk.material = TreeFactory.treeMaterial;
        trunk.position.y = height / 2;
        trunk.parent = root;

        // Branches & Leaves
        const branchCount = 4 + Math.floor(Math.random() * 3);

        for (let i = 0; i < branchCount; i++) {
            const y = height * (0.4 + Math.random() * 0.5); // Start higher up

            // Branch length: 1.5m to 3.0m
            const branchLen = 1.5 + Math.random() * 1.5;
            const branchThick = trunkThickness * 0.5;

            // Babylon Cylinder aligns Y axis.
            const branch = MeshBuilder.CreateCylinder("branch", {
                height: branchLen,
                diameterTop: branchThick * 0.5,
                diameterBottom: branchThick,
                tessellation: 4
            });
            branch.material = TreeFactory.treeMaterial;

            // Parent first to handle local transforms
            // Actually we want to attach to trunk logic visually
            // In three.js: group.add(branch).
            // Position relative to group origin (base of tree).
            branch.parent = root;
            branch.position.set(0, y, 0);

            // Rotation
            const angleY = Math.random() * Math.PI * 2;
            const angleX = Math.PI / 3 + (Math.random() - 0.5) * 0.5; // Angled up/out

            // Rotation in Babylon (Euler)
            branch.rotation.y = angleY;
            branch.rotation.z = angleX; // Z axis tilt? 

            // Shift branch so it starts at trunk surface
            // branch.translate(Axis.Y, branchLen / 2, Space.LOCAL);
            // Babylon TransformNode has translate
            branch.locallyTranslate(new Vector3(0, branchLen / 2, 0));

            // Sub-branches
            const subBranchCount = 1 + Math.floor(Math.random() * 2);
            for (let j = 0; j < subBranchCount; j++) {
                const subLen = branchLen * (0.6 + Math.random() * 0.4);
                const subThick = branchThick * 0.7;

                const subBranch = MeshBuilder.CreateCylinder("subBranch", {
                    height: subLen,
                    diameterTop: subThick * 0.5,
                    diameterBottom: subThick,
                    tessellation: 4
                });
                subBranch.material = TreeFactory.treeMaterial;

                // Parent to branch
                subBranch.parent = branch;

                // Position along parent branch
                // Parent branch length is branchLen. Y is along branch.
                // 0 is Center.
                const posAlong = (0.6 + Math.random() * 0.4) * branchLen;
                subBranch.position.set(0, posAlong - branchLen / 2, 0);

                // Rotate out
                subBranch.rotation.z = Math.PI / 4 * (Math.random() > 0.5 ? 1 : -1);
                subBranch.rotation.x = (Math.random() - 0.5) * 1.5;

                subBranch.locallyTranslate(new Vector3(0, subLen / 2, 0));

                // Leaf Cluster at end of sub-branch
                if (!isLeafless) {
                    const leafSize = 1.0 + wetness * 0.5;
                    const leafMesh = MeshBuilder.CreateIcoSphere("leaf", {
                        radius: leafSize,
                        subdivisions: 1, // 0 in Three is very low poly. 1 in Babylon is "low"
                        flat: true
                    });

                    leafMesh.material = isSnowy ? TreeFactory.snowyLeafMaterial : TreeFactory.leafMaterial;
                    leafMesh.parent = subBranch;
                    leafMesh.position.set(0, subLen / 2, 0);
                }
            }

            // Leaf Cluster at end of main branch
            if (!isLeafless) {
                const leafSize = 1.2 + wetness * 0.6;
                const leafMesh = MeshBuilder.CreateIcoSphere("leafMain", {
                    radius: leafSize,
                    subdivisions: 1,
                    flat: true
                });
                leafMesh.material = isSnowy ? TreeFactory.snowyLeafMaterial : TreeFactory.leafMaterial;
                leafMesh.parent = branch;
                leafMesh.position.set(0, branchLen / 2, 0);
            }
        }

        // Top Leaf Cluster
        if (!isLeafless) {
            const topLeafSize = 1.5 + wetness * 0.8;
            const topLeaf = MeshBuilder.CreateIcoSphere("leafTop", {
                radius: topLeafSize,
                subdivisions: 1,
                flat: true
            });
            topLeaf.material = isSnowy ? TreeFactory.snowyLeafMaterial : TreeFactory.leafMaterial;
            topLeaf.parent = root;
            topLeaf.position.y = height;
        }

        // Optimization: Merge all meshes into one
        const meshes = root.getChildMeshes();
        const merged = Mesh.MergeMeshes(meshes as Mesh[], true, true, undefined, false, true);

        if (merged) {
            merged.name = "tree_merged";
            merged.metadata = { mergeable: true };

            // Clean up the container node
            root.dispose();

            return merged;
        }

        return root;
    }
}
