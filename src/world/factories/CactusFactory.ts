import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

interface CactusArchetype {
    cactusGeo: THREE.BufferGeometry;
}

export class CactusFactory implements DecorationFactory {
    private static readonly cactusMaterial = new THREE.MeshToonMaterial({ color: 0x6B8E23, name: 'Cactus - Material' }); // Olive Drab

    private archetypes: CactusArchetype[] = [];

    async load(): Promise<void> {
        // Register material
        GraphicsUtils.registerObject(CactusFactory.cactusMaterial);

        // Clear existing archetypes
        this.archetypes.forEach(a => GraphicsUtils.disposeObject(a.cactusGeo));
        this.archetypes = [];

        console.log("Generating Cactus Archetypes...");
        for (let i = 0; i < 20; i++) {
            this.archetypes.push(this.generateArchetype());
        }
    }

    createInstance(): DecorationInstance[] {
        if (this.archetypes.length === 0) return [];

        const archetype = this.archetypes[Math.floor(Math.random() * this.archetypes.length)];
        return [{
            geometry: archetype.cactusGeo,
            material: CactusFactory.cactusMaterial,
            matrix: new THREE.Matrix4(),
            color: new THREE.Color(1, 1, 1) // Default color
        }];
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

    private generateArchetype(): CactusArchetype {
        const geometries: THREE.BufferGeometry[] = [];

        // Saguaro Parameters (2x Scale)
        const height = 3.0 + Math.random() * 3.0; // 3m to 6m
        const trunkRadius = 0.25 + Math.random() * 0.15; // Thicker trunk

        // Trunk
        const trunkGeo = new THREE.CapsuleGeometry(trunkRadius, height - trunkRadius * 2, 8, 16);
        trunkGeo.translate(0, height / 2, 0);
        geometries.push(trunkGeo);

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
            const startPoint = new THREE.Vector3(Math.cos(angle) * trunkRadius * 0.8, startHeight, Math.sin(angle) * trunkRadius * 0.8);
            const controlPoint = new THREE.Vector3(
                Math.cos(angle) * (trunkRadius + armOutwardDist),
                startHeight,
                Math.sin(angle) * (trunkRadius + armOutwardDist)
            );
            const endPoint = new THREE.Vector3(
                Math.cos(angle) * (trunkRadius + armOutwardDist),
                startHeight + armLengthVertical,
                Math.sin(angle) * (trunkRadius + armOutwardDist)
            );

            const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);

            // Tube Geometry
            const tubeGeo = new THREE.TubeGeometry(curve, 8, armRadius, 8, false);
            geometries.push(tubeGeo);

            // Cap the top of the arm
            const capGeo = new THREE.SphereGeometry(armRadius, 8, 8);
            capGeo.translate(endPoint.x, endPoint.y, endPoint.z);
            geometries.push(capGeo);
        }

        const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries);
        mergedGeo.name = 'Cactus - Merged Geometry';
        GraphicsUtils.registerObject(mergedGeo);

        // Clean up temporary geometries
        geometries.forEach(g => g.dispose());

        return { cactusGeo: mergedGeo };
    }
}
