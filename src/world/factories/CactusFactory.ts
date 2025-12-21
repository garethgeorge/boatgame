import {
    TransformNode,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Mesh,
    Vector3,
    Quaternion,
    Curve3
} from '@babylonjs/core';
import { DecorationFactory } from './DecorationFactory';

export class CactusFactory implements DecorationFactory {
    private static cactusMaterial: StandardMaterial;

    private cache: TransformNode[] = [];

    async load(): Promise<void> {
        this.cache = [];
        import('@babylonjs/core').then(core => {
            if (!CactusFactory.cactusMaterial) {
                CactusFactory.cactusMaterial = new core.StandardMaterial("cactusMat");
                CactusFactory.cactusMaterial.diffuseColor = core.Color3.FromHexString("#6B8E23"); // Olive Drab
                CactusFactory.cactusMaterial.specularColor = core.Color3.Black();
            }

            console.log("Generating Cactus Cache...");
            for (let i = 0; i < 20; i++) {
                const mesh = this.createCactus();
                mesh.setEnabled(false);
                this.cache.push(mesh);
            }
        });
    }

    create(options?: any): TransformNode {
        // Fallback
        if (!CactusFactory.cactusMaterial) return new TransformNode("cactus_placeholder");

        let mesh: TransformNode;
        if (this.cache.length === 0) {
            mesh = this.createCactus();
        } else {
            const source = this.cache[Math.floor(Math.random() * this.cache.length)];
            if (source) {
                mesh = source.instantiateHierarchy() as TransformNode;
                mesh.setEnabled(true);
            } else {
                mesh = this.createCactus();
            }
        }
        return mesh;
    }

    private createCactus(): TransformNode {
        const root = new TransformNode("cactus_root");

        // Saguaro Parameters (2x Scale)
        const height = 3.0 + Math.random() * 3.0; // 3m to 6m
        const trunkRadius = 0.25 + Math.random() * 0.15; // Thicker trunk

        // Trunk - Capsule
        const trunk = MeshBuilder.CreateCapsule("trunk", {
            radius: trunkRadius,
            height: height,
            subdivisions: 4,
            tessellation: 8
        });
        trunk.material = CactusFactory.cactusMaterial;
        trunk.position.y = height / 2;
        trunk.parent = root;

        // Arms
        const armCount = Math.floor(Math.random() * 4); // 0 to 3 arms

        for (let i = 0; i < armCount; i++) {
            // Arm parameters
            const armRadius = trunkRadius * (0.6 + Math.random() * 0.2); // Slightly thinner than trunk
            const startHeight = height * (0.3 + Math.random() * 0.4); // Start 30-70% up
            const armLengthVertical = (height - startHeight) * (0.5 + Math.random() * 0.5); // Go up a bit
            const armOutwardDist = 0.5 + Math.random() * 0.5; // How far out before going up

            const angle = Math.random() * Math.PI * 2;

            // Create Curve
            // Start at trunk surface
            const startPoint = new Vector3(Math.cos(angle) * trunkRadius * 0.8, startHeight, Math.sin(angle) * trunkRadius * 0.8);

            // Control point: Outwards and slightly up
            const controlPoint = new Vector3(
                Math.cos(angle) * (trunkRadius + armOutwardDist),
                startHeight,
                Math.sin(angle) * (trunkRadius + armOutwardDist)
            );

            // End point: Upwards
            const endPoint = new Vector3(
                Math.cos(angle) * (trunkRadius + armOutwardDist),
                startHeight + armLengthVertical,
                Math.sin(angle) * (trunkRadius + armOutwardDist)
            );

            // Babylon QuadraticBezier
            const curve = Curve3.CreateQuadraticBezier(startPoint, controlPoint, endPoint, 8);

            // Tube Geometry
            const arm = MeshBuilder.CreateTube("arm", {
                path: curve.getPoints(),
                radius: armRadius,
                tessellation: 8,
                cap: Mesh.NO_CAP // We will add a sphere cap
            });
            arm.material = CactusFactory.cactusMaterial;
            arm.parent = root;

            // Cap the top of the arm
            const cap = MeshBuilder.CreateSphere("armCap", {
                diameter: armRadius * 2,
                segments: 8
            });
            cap.material = CactusFactory.cactusMaterial;
            cap.position = endPoint;
            cap.parent = root;
            cap.parent = root;
        }

        // Optimization: Merge meshes
        const meshes = root.getChildMeshes();
        const merged = Mesh.MergeMeshes(meshes as Mesh[], true, true, undefined, false, true);

        if (merged) {
            merged.name = "cactus_merged";
            merged.metadata = { mergeable: true };
            root.dispose();
            return merged;
        }

        return root;
    }
}
