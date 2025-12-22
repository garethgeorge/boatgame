import * as THREE from 'three';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class TreeFernFactory implements DecorationFactory {
    private static readonly trunkMaterial = new THREE.MeshToonMaterial({ color: 0x3d2817, name: 'TreeFern - Trunk Material' }); // Dark fibrous brown
    private static readonly frondMaterial = new THREE.MeshToonMaterial({ color: 0x4a7023, name: 'TreeFern - Frond Material' }); // Fern Green

    private cache: {
        ferns: { mesh: THREE.Group }[];
    } = { ferns: [] };

    async load(): Promise<void> {
        // Retain static materials
        GraphicsUtils.registerObject(TreeFernFactory.trunkMaterial);
        GraphicsUtils.registerObject(TreeFernFactory.frondMaterial);

        // Clear existing cache and release old meshes
        this.cache.ferns.forEach(f => GraphicsUtils.disposeObject(f.mesh));
        this.cache.ferns = [];

        console.log("Generating Tree Fern Cache...");
        for (let i = 0; i < 20; i++) {
            const mesh = this.createTreeFern();
            this.cache.ferns.push({ mesh });
        }
    }

    create(): THREE.Group {
        let mesh: THREE.Group;
        if (this.cache.ferns.length > 0) {
            const source = this.cache.ferns[Math.floor(Math.random() * this.cache.ferns.length)];
            mesh = GraphicsUtils.cloneObject(source.mesh);
        } else {
            mesh = this.createTreeFern();
        }
        return mesh;
    }

    private createTreeFern(): THREE.Group {
        const group = new THREE.Group();

        // 3m to 7m tall (taller than cycads generally)
        const trunkHeight = 3.0 + Math.random() * 4.0;
        const trunkRadius = 0.15 + Math.random() * 0.1;
        const crownRadius = (0.75 + Math.random() * 0.25) * trunkHeight * 0.75;

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 6);
        trunkGeo.name = 'TreeFern - Trunk Geometry';
        const trunk = GraphicsUtils.createMesh(trunkGeo, TreeFernFactory.trunkMaterial);
        trunk.position.y = trunkHeight / 2 - 0.1;
        group.add(trunk);

        // Crown
        const crownY = trunkHeight - 0.1;
        const frondCount = 8 + Math.floor(Math.random() * 4);

        for (let i = 0; i < frondCount; i++) {
            // Leaf is a box shape we can sculpt
            // note that applying droop also moves the box to start at y=0
            const frondGeo = new THREE.BoxGeometry(1.0, crownRadius, 0.1, 1, 4, 1);
            frondGeo.name = 'TreeFern - Frond Geometry';
            this.applyFrondDroop(frondGeo);
            const frond = GraphicsUtils.createMesh(frondGeo, TreeFernFactory.frondMaterial);

            // arch out angle is pi/2 +/- pi/6
            const archAngle = -Math.PI / 2 + (Math.random() * 0.5) * Math.PI / 3;
            frond.rotateX(archAngle);

            // rotate around the trunk
            const frondPivot = new THREE.Group();
            const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.2);
            frondPivot.rotateY(angleY);

            // position at top
            frondPivot.position.set(0, crownY, 0);

            frondPivot.add(frond);
            group.add(frondPivot);
        }

        return group;
    }

    private applyFrondDroop(frondGeo: THREE.BoxGeometry) {
        // Quadratic droop curve parameters
        // The curve is defined by 3 points: start(0,0), mid(rmid, xmid), end(1, xend)
        // f(r) = ar^2 + br + c
        // c = 0
        // a + b = xend
        // a*rmid^2 + b*rmid = xmid => a rmid + b = xmid / rmid
        // a (1 - rmid) = xend - xmid / rmid => a = (xend rmid - xmid) / (rmid - rmid^2)

        // Ensure bounding box is available to determine height range
        frondGeo.computeBoundingBox();
        const box = frondGeo.boundingBox;
        if (!box) return;

        const height = box.max.y - box.min.y;
        const minY = box.min.y;

        const droopiness = Math.random();
        const xend = -height / 2; // Final droop down amount
        const xmid = height / 4;   // Initial arch up amount
        const rmid = 0.5;  // Position of the arch peak (0..1)

        // Solve for a and b
        // a = (xmid - xend * rmid) / (rmid^2 - rmid)
        const denominator = (rmid * rmid) - rmid;
        const a = (Math.abs(denominator) < 0.0001) ? 0 : (xmid - (xend * rmid)) / denominator;
        const b = xend - a;

        const positions = frondGeo.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < positions.count; i++) {
            v.fromBufferAttribute(positions, i);

            // Let's also shift the y positions so they start at the origin
            v.y -= minY;

            // Normalize Y position from 0 (base) to 1 (tip)
            const ratio = v.y / height;

            // f(r) = ar^2 + br
            // We add this to Z to displace the frond
            const offset = (a * ratio * ratio) + (b * ratio);
            v.z += offset;

            // Optional: Taper the width (X) slightly towards the tip for a more leaf-like shape
            const taper = 1.0 - (ratio * 0.7);
            v.x *= taper;

            positions.setXYZ(i, v.x, v.y, v.z);
        }

        positions.needsUpdate = true;
        frondGeo.computeVertexNormals();
        frondGeo.computeBoundingBox();
    }
}
