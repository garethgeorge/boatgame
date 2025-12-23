import * as THREE from 'three';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class CactusFactory implements DecorationFactory {
    private static readonly cactusMaterial = new THREE.MeshToonMaterial({ color: 0x6B8E23, name: 'Cactus - Material' }); // Olive Drab

    private cache: THREE.Group[] = [];

    async load(): Promise<void> {
        // Retain static materials
        GraphicsUtils.registerObject(CactusFactory.cactusMaterial);

        // Clear existing cache and release old meshes
        this.cache.forEach(m => GraphicsUtils.disposeObject(m));
        this.cache = [];

        console.log("Generating Cactus Cache...");
        for (let i = 0; i < 20; i++) {
            const mesh = this.createCactus();
            GraphicsUtils.markAsCache(mesh);
            this.cache.push(mesh);
        }
    }

    create(): THREE.Group {
        let mesh: THREE.Group;
        if (this.cache.length === 0) {
            mesh = this.createCactus();
        } else {
            mesh = this.cache[Math.floor(Math.random() * this.cache.length)].clone();
        }
        return mesh;
    }

    private createCactus(): THREE.Group {
        const group = new THREE.Group();

        // Saguaro Parameters (2x Scale)
        const height = 3.0 + Math.random() * 3.0; // 3m to 6m
        const trunkRadius = 0.25 + Math.random() * 0.15; // Thicker trunk

        // Trunk
        const trunkGeo = new THREE.CapsuleGeometry(trunkRadius, height - trunkRadius * 2, 8, 16);
        trunkGeo.name = 'Cactus - Trunk Geometry';
        const trunk = GraphicsUtils.createMesh(trunkGeo, CactusFactory.cactusMaterial, 'CactusTrunk');
        trunk.position.y = height / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

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
            const startPoint = new THREE.Vector3(Math.cos(angle) * trunkRadius * 0.8, startHeight, Math.sin(angle) * trunkRadius * 0.8);

            // Control point: Outwards and slightly up
            const controlPoint = new THREE.Vector3(
                Math.cos(angle) * (trunkRadius + armOutwardDist),
                startHeight,
                Math.sin(angle) * (trunkRadius + armOutwardDist)
            );

            // End point: Upwards
            const endPoint = new THREE.Vector3(
                Math.cos(angle) * (trunkRadius + armOutwardDist),
                startHeight + armLengthVertical,
                Math.sin(angle) * (trunkRadius + armOutwardDist)
            );

            const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);

            // Tube Geometry
            const tubeGeo = new THREE.TubeGeometry(curve, 8, armRadius, 8, false);
            tubeGeo.name = 'Cactus - Arm Geometry';
            const arm = GraphicsUtils.createMesh(tubeGeo, CactusFactory.cactusMaterial, 'CactusArm');
            arm.castShadow = true;
            arm.receiveShadow = true;
            group.add(arm);

            // Cap the top of the arm
            const capGeo = new THREE.SphereGeometry(armRadius, 8, 8);
            capGeo.name = 'Cactus - Arm Cap Geometry';
            const cap = GraphicsUtils.createMesh(capGeo, CactusFactory.cactusMaterial, 'CactusCap');
            cap.position.copy(endPoint);
            cap.castShadow = true;
            cap.receiveShadow = true;
            group.add(cap);
        }

        return group;
    }
}
