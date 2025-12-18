import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle } from '../behaviors/AttackAnimal';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { AnimationPlayer } from '../../core/AnimationPlayer';

export class Brontosaurus extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle {

    private readonly TARGET_WATER_HEIGHT: number = -1.5;

    private behavior: EntityBehavior | null = null;
    private player: AnimationPlayer;
    private aggressiveness: number;

    private applyModel(mesh: THREE.Group, onShore: boolean) {
        const modelData = Decorations.getBrontosaurus();
        if (!modelData)
            return;

        const model = modelData.model;
        const animations = modelData.animations;

        mesh.add(model);

        // Apply model transformations - assuming similar scale to polar bear
        model.scale.set(8.0, 8.0, 8.0);
        model.rotation.y = Math.PI;

        this.player = new AnimationPlayer(model, animations);
    }

    constructor(
        worldX: number,
        worldZ: number,
        physicsEngine: PhysicsEngine,
        angle: number = 0,
        height?: number,
        terrainNormal?: THREE.Vector3,
        onShore: boolean = false,
        stayOnShore: boolean = false
    ) {
        super();

        // Calculate aggressiveness for this brown bear
        this.aggressiveness = Math.random();

        // Brown bears can cause penalties when hit
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

        physicsBody.setUserData({ type: 'obstacle', subtype: 'brontosaurus', entity: this });

        // Graphics - simple single mesh
        // Entity.syncBodyMesh() will handle position and rotation with normal
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Apply the dino model
        this.applyModel(mesh, onShore);

        // Set height offset (Y position)
        if (height !== undefined)
            mesh.position.y = height;
        else
            mesh.position.y = this.TARGET_WATER_HEIGHT;

        // Set terrain normal for Entity.syncBodyMesh() to use
        if (terrainNormal) {
            this.normalVector = terrainNormal.clone();
        }

        if (onShore) {
            if (!stayOnShore) {
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            }
            this.player.play({ name: 'standing', timeScale: 0.5, startTime: -1 });
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
            this.player.play({ name: 'walking', timeScale: 0.5, startTime: -1 });
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
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    didStartEnteringWater(duration: number): void {
        this.player.play({ name: 'walking', timeScale: 0.5 });
    }

    enteringWaterDidComplete(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
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
