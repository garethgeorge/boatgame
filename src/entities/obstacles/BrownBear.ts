import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalBehavior } from '../behaviors/AttackAnimalBehavior';
import { AttackAnimal } from '../behaviors/AttackAnimal';

export class BrownBear extends Entity implements AttackAnimal {
    private action: THREE.AnimationAction | null = null;

    private applyModel(mesh: THREE.Group, onShore: boolean) {
        const bearData = Decorations.getBrownBear();
        if (!bearData)
            return;

        const model = bearData.model;
        const animations = bearData.animations;

        mesh.add(model);

        // Apply model transformations - assuming similar scale to polar bear
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            // Randomize speed between 1.8 and 2.2
            this.mixer.timeScale = 1.8 + Math.random() * 0.4;
            this.action = this.mixer.clipAction(animations[0]);
            // Randomize start time
            this.action.time = Math.random() * this.action.getClip().duration;

            if (onShore) {
                // If on shore, wait for trigger
            } else {
                this.action.play();
            }
        }
    }

    constructor(
        worldX: number,
        worldZ: number,
        physicsEngine: PhysicsEngine,
        angle: number = 0,
        height: number,
        terrainNormal?: THREE.Vector3,
        onShore: boolean = false
    ) {
        super();

        // Physics - dynamic body for potential future movement
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(worldX, worldZ),
            angle: -angle,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.5, 2.5), // 3m wide, 5m long
            density: 5.0,
            friction: 0.3,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'brownbear', entity: this });

        // Graphics - simple single mesh
        // Entity.syncBodyMesh() will handle position and rotation with normal
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Apply the polar bear model
        this.applyModel(mesh, onShore);

        // Set height offset (Y position)
        // Entity.sync() will control X and Z from physics body
        mesh.position.y = height;

        // Set terrain normal for Entity.syncBodyMesh() to use
        if (terrainNormal) {
            this.normalVector = terrainNormal.clone();
        }

        this.behavior = new AttackAnimalBehavior(this, onShore, -2.0);
    }

    private mixer: THREE.AnimationMixer | null = null;
    private behavior: AttackAnimalBehavior;

    onHit() {
        this.shouldRemove = true;
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }

        if (this.physicsBodies.length === 0) {
            // Sinking animation when hit
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.position.y -= dt * 2;
                if (mesh.position.y < -2) {
                    this.shouldRemove = true;
                }
            }
            return;
        }

        this.behavior.update();
    }

    // AttackAnimal interface implementation
    getPhysicsBody(): planck.Body | null {
        if (this.physicsBodies.length > 0) {
            return this.physicsBodies[0];
        }
        return null;
    }

    setLandPosition(height: number, normal: THREE.Vector3): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    setWaterPosition(height: number): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector.set(0, 1, 0);
    }

    didStartEnteringWater(): void {
        if (this.action) {
            this.action.play();
        }
    }
}
