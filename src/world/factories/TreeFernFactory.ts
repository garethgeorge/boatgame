import { TransformNode, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh, Engine } from '@babylonjs/core';
import { DecorationFactory } from './DecorationFactory';

export class TreeFernFactory implements DecorationFactory {
    private static trunkMaterial: StandardMaterial | null = null;
    private static frondMaterial: StandardMaterial | null = null;

    async load(): Promise<void> { }

    create(options?: any): TransformNode {
        const scene = Engine.LastCreatedScene;
        if (!scene) return new TransformNode("treefern_fail");

        const root = new TransformNode("treefern");
        const height = 4.0 + Math.random() * 2.5;

        // 1. Trunk
        const trunk = MeshBuilder.CreateCylinder("trunk", {
            diameterTop: 0.3,
            diameterBottom: 0.8,
            height: height
        }, scene);
        trunk.position.y = height / 2;
        trunk.material = TreeFernFactory.getTrunkMaterial(scene);
        trunk.parent = root;

        // 2. Fronds
        const frondCount = 8 + Math.floor(Math.random() * 6);
        const frondMeshes: Mesh[] = [];

        for (let i = 0; i < frondCount; i++) {
            const angle = (i / frondCount) * Math.PI * 2 + Math.random() * 0.2;
            const frondLen = 3.0 + Math.random() * 2.0;

            // Create frond geometry as a "drooping" ribbon or plane
            // We'll use a path and CreateTube or CreateRibbon for better look
            const points: Vector3[] = [];
            const segments = 6;
            for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                const r = t * frondLen;
                const y = Math.pow(t, 2) * -1.5; // Droop curve
                points.push(new Vector3(
                    Math.cos(angle) * r,
                    height + y,
                    Math.sin(angle) * r
                ));
            }

            const frond = MeshBuilder.CreateTube("frond", {
                path: points,
                radius: 0.15 * (1.0 - (points.length / segments) * 0.5), // Tapering
                tessellation: 6
            }, scene);
            frondMeshes.push(frond);
        }

        if (frondMeshes.length > 0) {
            const mergedFronds = Mesh.MergeMeshes(frondMeshes, true, true, undefined, false, true);
            if (mergedFronds) {
                mergedFronds.material = TreeFernFactory.getFrondMaterial(scene);
                mergedFronds.parent = root;
            }
        }

        return root;
    }

    private static getTrunkMaterial(scene: any): StandardMaterial {
        if (!this.trunkMaterial) {
            this.trunkMaterial = new StandardMaterial("treeFernTrunk", scene);
            this.trunkMaterial.diffuseColor = new Color3(0.3, 0.2, 0.1);
            this.trunkMaterial.specularColor = Color3.Black();
        }
        return this.trunkMaterial;
    }

    private static getFrondMaterial(scene: any): StandardMaterial {
        if (!this.frondMaterial) {
            this.frondMaterial = new StandardMaterial("treeFernFrond", scene);
            this.frondMaterial.diffuseColor = new Color3(0.1, 0.4, 0.1);
            this.frondMaterial.specularColor = Color3.Black();
            this.frondMaterial.backFaceCulling = false;
        }
        return this.frondMaterial;
    }
}
