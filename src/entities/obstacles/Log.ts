import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Log extends Entity {


    constructor(x: number, y: number, length: number, physicsEngine: PhysicsEngine) {
        super();

        // Log should be perpendicular to the river flow (roughly X-aligned) to block path
        // Physics Box takes (halfWidth, halfHeight).
        // We want length along X. So halfWidth = length/2, halfHeight = 0.5.

        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 2.0, // Heavy water resistance
            angularDamping: 1.0,
            bullet: true
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(length / 2, 0.6), // 1.2m thick log
            density: 100.0, // Heavy wood (5x increase from 20.0)
            friction: 0.8, // Rough
            restitution: 0.1
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'log', entity: this });

        // Graphics
        // Cylinder is Y-up by default.
        // We want it along X-axis to match Physics Box(length, thickness).
        // Rotate around Z axis by 90 deg.
        const geo = new THREE.CylinderGeometry(0.6, 0.6, length, 12);
        const mat = new THREE.MeshToonMaterial({ color: 0x5C4033 }); // Darker Brown
        const mesh = new THREE.Mesh(geo, mat);
        this.meshes.push(mesh);

        mesh.rotation.z = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    onHit() {
        // Logs don't break, they block!
    }

    update(dt: number) {
        // Just floats
    }
}
