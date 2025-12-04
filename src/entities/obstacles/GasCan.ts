import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class GasCan extends Entity {

    private floatOffset: number = Math.random() * Math.PI * 2;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const physicsBody = physicsEngine.world.createBody({
            type: 'static', // Static sensor
            position: planck.Vec2(x, y)
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(0.5, 0.5),
            isSensor: true
        });

        physicsBody.setUserData({ type: 'collectable', subtype: 'gas', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Main Body
        const geo = new THREE.BoxGeometry(1.2, 1.6, 0.8); // Doubled
        const mat = new THREE.MeshToonMaterial({ color: 0xFF0000 }); // Red
        const can = new THREE.Mesh(geo, mat);
        can.position.y = 0.8;
        mesh.add(can);

        // Handle
        const handleGeo = new THREE.TorusGeometry(0.3, 0.1, 8, 16); // Doubled
        const handleMat = new THREE.MeshToonMaterial({ color: 0xFF0000 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = 1.8;
        // Fix rotation: was Math.PI / 2 (90 deg), user says off by 90.
        // Torus default is flat on XY plane.
        // If we want it upright like a suitcase handle?
        // Let's try 0 or PI.
        handle.rotation.y = 0;
        mesh.add(handle);

        // Spout
        const spoutGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.6, 8); // Doubled
        const spoutMat = new THREE.MeshToonMaterial({ color: 0xFFD700 }); // Yellow
        const spout = new THREE.Mesh(spoutGeo, spoutMat);
        spout.position.set(0.4, 1.6, 0);
        spout.rotation.z = -Math.PI / 4;
        mesh.add(spout);
    }

    onHit() {
        this.shouldRemove = true;
    }

    update(dt: number) {
        if (this.physicsBodies.length === 0) {
            // Floating up animation
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.position.y += dt * 2;
                mesh.rotation.y += dt * 5;
                // Fade out? Hard to do with Group materials easily without iterating
                // Just float up high enough then remove
                if (mesh.position.y > 5) {
                    this.shouldRemove = true;
                }
            }
            return;
        }

        // Float animation
        this.floatOffset += dt * 2;
        if (this.meshes.length > 0) {
            const mesh = this.meshes[0];
            mesh.position.y = Math.sin(this.floatOffset) * 0.2 + 0.5; // +0.5 base height
            mesh.rotation.y += dt;
        }
    }
}
