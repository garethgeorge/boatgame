import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance, NUM_DECORATION_ARCHETYPES } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

interface CycadArchetype {
    trunkGeo: THREE.BufferGeometry;
    frondGeo: THREE.BufferGeometry;
    coneGeo?: THREE.BufferGeometry;
}

export class CycadFactory implements DecorationFactory {
    private static readonly trunkMaterial = new THREE.MeshToonMaterial({ color: 0x5C4033, name: 'Cycad - Trunk Material' }); // Darker brown
    private static readonly frondMaterial = new THREE.MeshToonMaterial({ color: 0x2E8B57, name: 'Cycad - Frond Material' }); // Sea Green / Dark Green
    private static readonly coneMaterial = new THREE.MeshToonMaterial({ color: 0xCD853F, name: 'Cycad - Cone Material' }); // Peru (brownish orange)

    private archetypes: CycadArchetype[] = [];
    private loadingPromise: Promise<void> | null = null;

    async load(): Promise<void> {
        if (this.archetypes.length > 0) return Promise.resolve();
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            // Register static materials
            GraphicsUtils.registerObject(CycadFactory.trunkMaterial);
            GraphicsUtils.registerObject(CycadFactory.frondMaterial);
            GraphicsUtils.registerObject(CycadFactory.coneMaterial);

            // Pre-generate cycad archetypes
            console.log("Generating Cycad Archetypes...");
            for (let i = 0; i < NUM_DECORATION_ARCHETYPES; i++) {
                this.archetypes.push(this.generateArchetype());
            }
            this.loadingPromise = null;
        })();

        return this.loadingPromise;
    }

    createInstance(): DecorationInstance[] {
        if (this.archetypes.length === 0) return [];

        const archetype = this.archetypes[Math.floor(Math.random() * this.archetypes.length)];
        const result: DecorationInstance[] = [];

        // Trunk
        result.push({
            geometry: archetype.trunkGeo,
            material: CycadFactory.trunkMaterial,
            matrix: new THREE.Matrix4(),
            color: new THREE.Color(1, 1, 1)
        });

        // Fronds
        result.push({
            geometry: archetype.frondGeo,
            material: CycadFactory.frondMaterial,
            matrix: new THREE.Matrix4(),
            color: new THREE.Color(1, 1, 1)
        });

        // Optional Cone
        if (archetype.coneGeo) {
            result.push({
                geometry: archetype.coneGeo,
                material: CycadFactory.coneMaterial,
                matrix: new THREE.Matrix4(),
                color: new THREE.Color(1, 1, 1)
            });
        }

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

    private generateArchetype(): CycadArchetype {
        // Cycad parameters
        const trunkHeight = 1.5 + 10.0 * Math.pow(Math.random(), 2.0);
        const trunkRadius = 0.2 + Math.random() * 0.3;
        const crownRadius = (3.0 + Math.random() * 5.0) * trunkRadius * 1.414;
        const crownY = trunkHeight - 0.1;

        // Trunk Geometry
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 5);
        trunkGeo.translate(0, trunkHeight / 2 - 0.1, 0);
        GraphicsUtils.registerObject(trunkGeo);

        // Frond Geometries
        const frondGeos: THREE.BufferGeometry[] = [];
        const frondCount = 10 + Math.floor(Math.random() * 6);

        for (let i = 0; i < frondCount; i++) {
            const fGeo = new THREE.CylinderGeometry(0.01, 0.2, crownRadius, 4);
            // Move base to origin
            fGeo.translate(0, crownRadius / 2, 0);

            // Apply rosette transformation
            const archAngle = Math.PI / 4 + Math.random() * 0.4;
            const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.1);

            // Exactly mirror the previous hierarchy:
            // Group -> Pivot (Pos, RotY) -> Frond (RotX, Scale)
            // Matrix = Translation(crownY) * RotationY(angleY) * RotationX(archAngle) * Scale(1, 1, 0.025)
            const matrix = new THREE.Matrix4()
                .makeTranslation(0, crownY, 0)
                .multiply(new THREE.Matrix4().makeRotationY(angleY))
                .multiply(new THREE.Matrix4().makeRotationX(archAngle))
                .multiply(new THREE.Matrix4().makeScale(1.0, 1.0, 0.025));

            fGeo.applyMatrix4(matrix);
            frondGeos.push(fGeo);
        }

        const mergedFrondGeo = BufferGeometryUtils.mergeGeometries(frondGeos);
        mergedFrondGeo.name = 'Cycad - Frond Merged Geometry';
        GraphicsUtils.registerObject(mergedFrondGeo);
        frondGeos.forEach(g => g.dispose());

        // Optional Cone
        let coneGeo: THREE.BufferGeometry | undefined;
        if (Math.random() > 0.4) {
            const coneRadius = trunkRadius * 0.7;
            const coneHeight = coneRadius * 6.0;
            coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 6);
            coneGeo.translate(0, crownY + coneHeight / 2, 0);
            GraphicsUtils.registerObject(coneGeo);
        }

        return { trunkGeo, frondGeo: mergedFrondGeo, coneGeo };
    }
}
