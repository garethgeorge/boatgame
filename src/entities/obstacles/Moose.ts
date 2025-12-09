import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalShoreBehavior } from '../behaviors/AttackAnimalShoreBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { AnimalBehavior } from '../behaviors/AnimalBehavior';
import { AttackAnimal } from '../behaviors/AttackAnimal';

export class Moose extends Entity implements AttackAnimal {
    private readonly TARGET_WATER_HEIGHT = -3.0;
    private walkingAction: THREE.AnimationAction | null = null;
    private idleAction: THREE.AnimationAction | null = null;

    private applyModel(mesh: THREE.Group, onShore: boolean) {
        const mooseData = Decorations.getMoose();
        if (!mooseData)
            return;

        const model = mooseData.model;
        const animations = mooseData.animations;

        mesh.add(model);

        // Apply model transformations
        model.position.y = 3.0;
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);

            const idleClip = animations.find(a => a.name === 'idle');
            const walkingClip = animations.find(a => a.name === 'walk');

            if (idleClip) {
                this.idleAction = this.mixer.clipAction(idleClip);
            }

            if (walkingClip) {
                this.walkingAction = this.mixer.clipAction(walkingClip);
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
        onShore: boolean = false,
        stayOnShore: boolean = false
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

        physicsBody.setUserData({ type: 'obstacle', subtype: 'moose', entity: this });

        // Graphics - simple single mesh
        // Entity.syncBodyMesh() will handle position and rotation with normal
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Apply the moose model
        this.applyModel(mesh, onShore);

        // Set height offset (Y position)
        // Entity.sync() will control X and Z from physics body
        mesh.position.y = height;

        // Set terrain normal for Entity.syncBodyMesh() to use
        if (terrainNormal) {
            this.normalVector = terrainNormal.clone();
        }

        if (onShore) {
            if (!stayOnShore) {
                this.behavior = new AttackAnimalShoreBehavior(this, this.TARGET_WATER_HEIGHT);
            }
            if (this.idleAction) {
                this.idleAction.time = Math.random() * this.idleAction.getClip().duration;
                this.idleAction.play();
            }
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this);
            if (this.walkingAction) {
                this.walkingAction.time = Math.random() * this.walkingAction.getClip().duration;
                this.walkingAction.play();
            }
        }
    }

    private mixer: THREE.AnimationMixer | null = null;
    private behavior: AnimalBehavior | null = null;

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

        if (this.behavior) {
            this.behavior.update();
        }
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

    didStartEnteringWater(): void {
        if (this.idleAction && this.walkingAction) {
            this.walkingAction.reset();
            this.walkingAction.time = Math.random() * this.walkingAction.getClip().duration;
            this.walkingAction.play();
            this.idleAction.crossFadeTo(this.walkingAction, 1.0, true);
        }
    }

    didCompleteEnteringWater(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, speed);

        if (this.meshes.length > 0) {
            this.meshes[0].position.y = this.TARGET_WATER_HEIGHT;
        }
        this.normalVector.set(0, 1, 0);
    }

}
