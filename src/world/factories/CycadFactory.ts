import * as THREE from 'three';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class CycadFactory implements DecorationFactory {
    private static readonly trunkMaterial = new THREE.MeshToonMaterial({ color: 0x5C4033 }); // Darker brown
    private static readonly frondMaterial = new THREE.MeshToonMaterial({ color: 0x2E8B57 }); // Sea Green / Dark Green
    private static readonly coneMaterial = new THREE.MeshToonMaterial({ color: 0xCD853F }); // Peru (brownish orange)

    // Cache stores arrays of pre-generated cycads
    private cache: {
        cycads: { mesh: THREE.Group }[];
    } = { cycads: [] };

    async load(): Promise<void> {
        // Retain static materials
        GraphicsUtils.tracker.retain(CycadFactory.trunkMaterial);
        GraphicsUtils.tracker.retain(CycadFactory.frondMaterial);
        GraphicsUtils.tracker.retain(CycadFactory.coneMaterial);

        // Clear existing cache and release old meshes
        this.cache.cycads.forEach(c => GraphicsUtils.tracker.release(c.mesh));
        this.cache.cycads = [];

        // Pre-generate cycads
        console.log("Generating Cycad Cache...");

        for (let i = 0; i < 20; i++) {
            const mesh = this.createCycad();
            GraphicsUtils.tracker.retain(mesh);
            this.cache.cycads.push({ mesh });
        }
    }

    create(): THREE.Group {
        let mesh: THREE.Group;

        if (this.cache.cycads.length > 0) {
            const source = this.cache.cycads[Math.floor(Math.random() * this.cache.cycads.length)];
            mesh = source.mesh.clone();
        } else {
            mesh = this.createCycad();
        }

        return mesh;
    }

    private createCycad(): THREE.Group {
        const group = new THREE.Group();

        // Cycad parameters
        // Mostly a few meters, some tall
        const trunkHeight = 1.5 + 10.0 * Math.pow(Math.random(), 2.0);

        // Thickness independent of height
        const trunkRadius = 0.2 + Math.random() * 0.3;

        // Crown size depends on thickness
        // 1.414 factor accounts for angling leaves
        const crownRadius = (3.0 + Math.random() * 5.0) * trunkRadius * 1.414;

        // Trunk
        // Rough, scarred look - maybe just a cylinder for now
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 5);
        const trunk = new THREE.Mesh(trunkGeo, CycadFactory.trunkMaterial);
        trunk.position.y = trunkHeight / 2 - 0.1;  // to bury it in the ground
        group.add(trunk);

        // Crown location
        const crownY = trunkHeight - 0.1;

        // Fronds
        // Cycads have a rosette of pinnate leaves (fronds)
        const frondCount = 10 + Math.floor(Math.random() * 6);

        for (let i = 0; i < frondCount; i++) {
            // We'll mimic a frond shape using a flattened scale on a cylinder/cone
            // Cyclinder is created at origin and with center along y axis
            // Top radius will be the width at the tip, bottom is the width at the frond start
            const frondGeo = new THREE.CylinderGeometry(0.01, 0.2, crownRadius, 4);
            // Translate geometry so the base is at the origin (0,0,0)
            frondGeo.translate(0, crownRadius / 2, 0);

            const frond = new THREE.Mesh(frondGeo, CycadFactory.frondMaterial);

            // Flatten to resemble a leaf blade 
            frond.scale.set(1.0, 1.0, 0.025);

            // Rotate around x to make it stick out
            // Random variation in "perkiness"
            const archAngle = Math.PI / 4 + Math.random() * 0.4;
            frond.rotation.x = archAngle;

            // Pivot group now positions the frond vertically and around y axis
            const frondPivot = new THREE.Group();
            frondPivot.position.set(0, crownY, 0);

            // Distribute evenly around the trunk
            const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.1);
            frondPivot.rotation.y = angleY;

            frondPivot.add(frond);
            group.add(frondPivot);
        }

        // Central Cone (reproductive structure, common in cycads)
        if (Math.random() > 0.4) {
            const coneRadius = trunkRadius * 0.7;
            const coneHeight = coneRadius * 6.0;
            const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 6);
            const cone = new THREE.Mesh(coneGeo, CycadFactory.coneMaterial);
            cone.position.y = crownY + coneHeight / 2;
            group.add(cone);
        }

        return group;
    }
}
