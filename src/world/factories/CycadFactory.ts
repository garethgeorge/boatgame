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

export class CycadFactory implements DecorationFactory {
    private static trunkMaterial: StandardMaterial;
    private static frondMaterial: StandardMaterial;
    private static coneMaterial: StandardMaterial;

    private cache: {
        cycads: { mesh: TransformNode }[];
    } = { cycads: [] };

    async load(): Promise<void> {
        this.cache.cycads = [];
        import('@babylonjs/core').then(core => {
            if (!CycadFactory.trunkMaterial) {
                CycadFactory.trunkMaterial = new core.StandardMaterial("cycadTrunk");
                CycadFactory.trunkMaterial.diffuseColor = core.Color3.FromHexString("#5C4033");
                CycadFactory.trunkMaterial.specularColor = core.Color3.Black();

                CycadFactory.frondMaterial = new core.StandardMaterial("cycadFrond");
                CycadFactory.frondMaterial.diffuseColor = core.Color3.FromHexString("#2E8B57");
                CycadFactory.frondMaterial.specularColor = core.Color3.Black();
                CycadFactory.frondMaterial.backFaceCulling = false;

                CycadFactory.coneMaterial = new core.StandardMaterial("cycadCone");
                CycadFactory.coneMaterial.diffuseColor = core.Color3.FromHexString("#CD853F");
                CycadFactory.coneMaterial.specularColor = core.Color3.Black();
            }

            console.log("Generating Cycad Cache...");
            for (let i = 0; i < 20; i++) {
                const mesh = this.createCycad();
                mesh.setEnabled(false);
                this.cache.cycads.push({ mesh });
            }
        });
    }

    create(options?: any): TransformNode {
        // Fallback
        if (!CycadFactory.trunkMaterial) return new TransformNode("cycad_placeholder");

        let mesh: TransformNode;

        if (this.cache.cycads.length > 0) {
            const source = this.cache.cycads[Math.floor(Math.random() * this.cache.cycads.length)];
            mesh = source.mesh.instantiateHierarchy() as TransformNode;
            mesh.setEnabled(true);
        } else {
            mesh = this.createCycad();
        }

        return mesh;
    }

    private createCycad(): TransformNode {
        const root = new TransformNode("cycad_root");

        // Cycad parameters
        // Mostly a few meters, some tall
        const trunkHeight = 1.5 + 10.0 * Math.pow(Math.random(), 2.0);

        // Thickness independent of height
        const trunkRadius = 0.2 + Math.random() * 0.3;

        // Crown size depends on thickness
        // 1.414 factor accounts for angling leaves
        const crownRadius = (3.0 + Math.random() * 5.0) * trunkRadius * 1.414;

        // Trunk
        const trunk = MeshBuilder.CreateCylinder("trunk", {
            height: trunkHeight,
            diameterTop: trunkRadius,
            diameterBottom: trunkRadius * 0.7, // Original was cylinder with slightly different top/bottom? code said cylinder.
            tessellation: 5
        });
        trunk.material = CycadFactory.trunkMaterial;
        trunk.position.y = trunkHeight / 2 - 0.1;
        trunk.parent = root;

        // Crown location
        const crownY = trunkHeight - 0.1;

        // Fronds
        // Cycads have a rosette of pinnate leaves (fronds)
        const frondCount = 10 + Math.floor(Math.random() * 6);

        for (let i = 0; i < frondCount; i++) {
            // Frond Mesh (Flattened cylinder/cone)
            // Original: CylinderGeometry(0.01, 0.2, crownRadius, 4) translated (0, crownRadius/2, 0)

            // Babylon CreateCylinder
            const frond = MeshBuilder.CreateCylinder("frond", {
                height: crownRadius,
                diameterTop: 0.01,
                diameterBottom: 0.2,
                tessellation: 4
            });
            // Original logic: translated (0, crownRadius/2, 0).
            // Babylon cylinder pivot is center.
            // Moving it so base is at origin?
            // If base radius is 0.2 and top is 0.01.
            // Base is at -height/2.
            // We want base at 0.
            frond.locallyTranslate(new Vector3(0, crownRadius / 2, 0));

            frond.material = CycadFactory.frondMaterial;

            // Flatten
            frond.scaling.set(1.0, 1.0, 0.025);

            // Rotate around x to make it stick out
            const archAngle = Math.PI / 4 + Math.random() * 0.4;
            frond.rotation.x = archAngle;

            // Pivot group
            const frondPivot = new TransformNode("frond_pivot");
            frondPivot.position.set(0, crownY, 0);

            // Distribute evenly around the trunk
            const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.1);
            frondPivot.rotation.y = angleY;
            frondPivot.parent = root;

            frond.parent = frondPivot;
        }

        // Central Cone
        if (Math.random() > 0.4) {
            const coneRadius = trunkRadius * 0.7;
            const coneHeight = coneRadius * 6.0;

            const cone = MeshBuilder.CreateCylinder("cone", {
                height: coneHeight,
                diameterTop: 0,
                diameterBottom: coneRadius,
                tessellation: 6
            });
            cone.material = CycadFactory.coneMaterial;
            cone.position.y = crownY + coneHeight / 2;
            cone.parent = root;
        }

        return root;
    }
}
