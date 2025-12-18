import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AnimationPlayer } from '../../core/AnimationPlayer';

import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle } from '../behaviors/AttackAnimalBehavior';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export class Moose extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle {

    private readonly TARGET_WATER_HEIGHT = -3.0;

    private player: AnimationPlayer | null = null;
    private behavior: EntityBehavior | null = null;
    private aggressiveness: number;

    private applyModel(mesh: THREE.Group, onShore: boolean) {
        const mooseData = Decorations.getMoose();
        if (!mooseData)
            return;

        const model = mooseData.model;
        const animations = mooseData.animations;

        mesh.add(model);

        // Apply model transformations
        model.position.y = 3.0;
        model.scale.set(0.1, 0.1, 0.1);
        model.rotation.y = Math.PI;

        this.player = new AnimationPlayer(model, animations);
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

        // Calculate aggressiveness for this moose
        this.aggressiveness = Math.random();

        // Moose can cause penalties when hit
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
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            }
            if (this.player) {
                this.player.play({ name: 'idle', startTime: -1 });
            }
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
            if (this.player) {
                this.player.play({ name: 'walk', startTime: -1 });
            }
        }
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    update(dt: number) {
        if (this.player) {
            this.player.update(dt);
        }
        if (this.behavior) {
            this.behavior.update(dt);
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
            const t = Math.max(0, Math.min(progress, 1));
            const curve = 4 * t * (1.0 - t);
            const jumpHeight = 2.0 * curve;
            this.meshes[0].position.y = height + jumpHeight;
        }
        this.normalVector.copy(normal);
    }

    didStartEnteringWater(duration: number): void {
        if (!this.player) {
            return;
        }

        if (duration > 0.5) {
            const startTimeScale = 0.5;
            const endTimeScale = 0.5;
            const fallDuration = duration - startTimeScale - endTimeScale;

            this.player.playSequence([
                { name: 'jump_start', duration: startTimeScale },
                { name: 'jump_fall', duration: fallDuration },
                { name: 'jump_end', duration: endTimeScale }
            ]);
        } else {
            this.player.play({ name: 'walk', startTime: -1 });
        }
    }

    enteringWaterDidComplete(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);

        if (this.meshes.length > 0) {
            this.meshes[0].position.y = this.TARGET_WATER_HEIGHT;
        }
        this.normalVector.set(0, 1, 0);

        // Transition to walking
        if (this.player) {
            this.player.play({ name: 'walk', startTime: -1 });
        }
    }

    shoreIdleMaybeStartEnteringWater(): boolean {

        // Create entering water behavior
        const behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            this.TARGET_WATER_HEIGHT,
            this.aggressiveness
        );
        this.behavior = behavior;

        // Use duration from behavior for animation callbacks
        this.didStartEnteringWater(behavior.duration);

        return true;
    }

}
