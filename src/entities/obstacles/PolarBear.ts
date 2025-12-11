import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { AnimalBehavior } from '../behaviors/AnimalBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle } from '../behaviors/AttackAnimal';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';

export class PolarBear extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle {
    private rearingAction: THREE.AnimationAction | null = null;
    private walkingAction: THREE.AnimationAction | null = null;
    private behavior: AnimalBehavior | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    private aggressiveness: number;

    private applyModel(mesh: THREE.Group) {
        const bearData = Decorations.getPolarBear();
        if (!bearData)
            return;

        const model = bearData.model;
        const animations = bearData.animations;

        mesh.add(model);

        // Apply model transformations
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);

            // Find specific animations
            const rearingClip = animations.find(a => a.name === 'Rearing');
            const walkingClip = animations.find(a => a.name === 'Walking');

            if (rearingClip) {
                this.rearingAction = this.mixer.clipAction(rearingClip);
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

        // Calculate aggressiveness for this polar bear
        this.aggressiveness = Math.random();

        // Polar bears can cause penalties when hit
        this.canCausePenalty = true;

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

        physicsBody.setUserData({ type: 'obstacle', subtype: 'polarbear', entity: this });

        // Graphics - simple single mesh
        // Entity.syncBodyMesh() will handle position and rotation with normal
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Apply the polar bear model
        this.applyModel(mesh);

        // Set height offset (Y position)
        // Entity.sync() will control X and Z from physics body
        mesh.position.y = height;

        // Set terrain normal for Entity.syncBodyMesh() to use
        if (terrainNormal) {
            this.normalVector = terrainNormal.clone();
        }

        // Randomize rear start time
        this.rearingAction.time = Math.random() * this.rearingAction.getClip().duration;
        this.rearingAction.play();

        // Initialize behavior with target water height -2.0 (similar to brown bear)
        if (onShore) {
            if (!stayOnShore) {
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            }
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        }
    }

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

    setLandPosition(height: number, normal: THREE.Vector3, progress: number): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    didStartEnteringWater(duration: number): void {
        if (this.rearingAction && this.walkingAction) {
            this.walkingAction.reset();
            this.walkingAction.time = Math.random() * this.walkingAction.getClip().duration;
            this.walkingAction.play();
            this.rearingAction.crossFadeTo(this.walkingAction, 1.0, true);
        }
    }

    didCompleteEnteringWater(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
    }

    shouldStartEnteringWater(): boolean {
        const targetWaterHeight = -2.0;

        // Create entering water behavior
        const behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            targetWaterHeight,
            this.aggressiveness
        );
        this.behavior = behavior;

        // Use duration from behavior for animation callbacks
        this.didStartEnteringWater(behavior.duration);

        return true;
    }

}
