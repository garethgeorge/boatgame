import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance, NUM_DECORATION_ARCHETYPES } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

interface TreeFernArchetype {
    trunkGeo: THREE.BufferGeometry;
    frondGeo: THREE.BufferGeometry;
}

export class TreeFernFactory implements DecorationFactory {
    private static readonly trunkMaterial = new THREE.MeshToonMaterial({ color: 0x3d2817, name: 'TreeFern - Trunk Material' }); // Dark fibrous brown
    private static readonly frondMaterial = new THREE.MeshToonMaterial({ color: 0x4a7023, name: 'TreeFern - Frond Material' }); // Fern Green

    private archetypes: TreeFernArchetype[] = [];

    async load(): Promise<void> {
        // Register static materials
        GraphicsUtils.registerObject(TreeFernFactory.trunkMaterial);
        GraphicsUtils.registerObject(TreeFernFactory.frondMaterial);

        // Clear existing archetypes
        this.archetypes.forEach(a => {
            GraphicsUtils.disposeObject(a.trunkGeo);
            GraphicsUtils.disposeObject(a.frondGeo);
        });
        this.archetypes = [];

        console.log("Generating Tree Fern Archetypes...");
        for (let i = 0; i < NUM_DECORATION_ARCHETYPES; i++) {
            this.archetypes.push(this.generateArchetype());
        }
    }

    createInstance(): DecorationInstance[] {
        if (this.archetypes.length === 0) return [];

        const archetype = this.archetypes[Math.floor(Math.random() * this.archetypes.length)];
        const result: DecorationInstance[] = [];

        // Trunk
        result.push({
            geometry: archetype.trunkGeo,
            material: TreeFernFactory.trunkMaterial,
            matrix: new THREE.Matrix4(),
            color: new THREE.Color(1, 1, 1)
        });

        // Fronds
        result.push({
            geometry: archetype.frondGeo,
            material: TreeFernFactory.frondMaterial,
            matrix: new THREE.Matrix4(),
            color: new THREE.Color(1, 1, 1)
        });

        return result;
    }

    create(): THREE.Group {
        const instances = this.createInstance();
        const group = new THREE.Group();
        for (const inst of instances) {
            const mesh = GraphicsUtils.createMesh(inst.geometry, inst.material);
            mesh.applyMatrix4(inst.matrix);
            group.add(mesh);
        }
        return group;
    }

    private generateArchetype(): TreeFernArchetype {
        // 3m to 7m tall
        const trunkHeight = 3.0 + Math.random() * 4.0;
        const trunkRadius = 0.15 + Math.random() * 0.1;
        const crownRadius = (0.75 + Math.random() * 0.25) * trunkHeight * 0.75;
        const crownY = trunkHeight - 0.1;

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 6);
        trunkGeo.translate(0, trunkHeight / 2 - 0.1, 0);
        GraphicsUtils.registerObject(trunkGeo);

        // Fronds
        const frondGeos: THREE.BufferGeometry[] = [];
        const frondCount = 8 + Math.floor(Math.random() * 4);

        for (let i = 0; i < frondCount; i++) {
            const fGeo = new THREE.BoxGeometry(1.0, crownRadius, 0.1, 1, 4, 1);
            this.applyFrondDroop(fGeo);

            const archAngle = -Math.PI / 2 + (Math.random() * 0.5) * Math.PI / 3;
            const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.2);

            // Hierarchy: Pivot(crownY, angleY) -> Frond(archAngle)
            // Matrix = Translation * RotationY * RotationX
            const matrix = new THREE.Matrix4()
                .makeTranslation(0, crownY, 0)
                .multiply(new THREE.Matrix4().makeRotationY(angleY))
                .multiply(new THREE.Matrix4().makeRotationX(archAngle));

            fGeo.applyMatrix4(matrix);
            frondGeos.push(fGeo);
        }

        const mergedFrondGeo = BufferGeometryUtils.mergeGeometries(frondGeos);
        mergedFrondGeo.name = 'TreeFern - Frond Merged Geometry';
        GraphicsUtils.registerObject(mergedFrondGeo);
        frondGeos.forEach(g => g.dispose());

        return { trunkGeo, frondGeo: mergedFrondGeo };
    }

    private applyFrondDroop(frondGeo: THREE.BoxGeometry) {
        frondGeo.computeBoundingBox();
        const box = frondGeo.boundingBox;
        if (!box) return;

        const height = box.max.y - box.min.y;
        const minY = box.min.y;

        const xend = -height / 2; // Final droop down amount
        const xmid = height / 4;   // Initial arch up amount
        const rmid = 0.5;  // Position of the arch peak (0..1)

        const denominator = (rmid * rmid) - rmid;
        const a = (Math.abs(denominator) < 0.0001) ? 0 : (xmid - (xend * rmid)) / denominator;
        const b = xend - a;

        const positions = frondGeo.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < positions.count; i++) {
            v.fromBufferAttribute(positions, i);

            // Shift it so it starts at the origin (base of the frond)
            v.y -= minY;

            const ratio = v.y / height;
            const offset = (a * ratio * ratio) + (b * ratio);
            v.z += offset;

            const taper = 1.0 - (ratio * 0.7);
            v.x *= taper;

            positions.setXYZ(i, v.x, v.y, v.z);
        }

        positions.needsUpdate = true;
        frondGeo.computeVertexNormals();
        frondGeo.computeBoundingBox();
    }
}
