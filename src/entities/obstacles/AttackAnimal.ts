import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle, AttackAnimalWater } from '../behaviors/AttackAnimalBehavior';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export interface AttackAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: THREE.Vector3;
    onShore?: boolean;
    stayOnShore?: boolean;
}

export interface AttackAnimalPhysicsOptions {
    halfWidth: number;
    halfLength: number;
    density?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
}

export abstract class AttackAnimal extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle, AttackAnimalWater {
    protected player: AnimationPlayer | null = null;
    protected behavior: EntityBehavior | null = null;
    protected aggressiveness: number;

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        options: AttackAnimalOptions,
        physicsOptions: AttackAnimalPhysicsOptions
    ) {
        super();

        const {
            x,
            y,
            height,
            angle = 0,
            terrainNormal,
            onShore = false,
            stayOnShore = false
        } = options;

        const {
            halfWidth,
            halfLength,
            density = 5.0,
            friction = 0.1,
            restitution = 0.0,
            linearDamping = 2.0,
            angularDamping = 1.0
        } = physicsOptions;

        this.aggressiveness = Math.random();
        this.canCausePenalty = true;

        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            angle: -angle,
            linearDamping: linearDamping,
            angularDamping: angularDamping
        });
        physicsBody.createFixture({
            shape: planck.Box(halfWidth, halfLength),
            density: density,
            friction: friction,
            restitution: restitution
        });
        physicsBody.setUserData({ type: 'obstacle', subtype: subtype, entity: this });
        this.physicsBodies.push(physicsBody);

        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        const modelData = this.getModelData();
        if (modelData) {
            this.applyModelBase(mesh, modelData.model, modelData.animations);
        }

        mesh.position.y = height;

        if (terrainNormal)
            this.normalVector = terrainNormal.clone();
        else
            this.normalVector = new THREE.Vector3(0, 1, 0);

        if (onShore) {
            if (!stayOnShore) {
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            }
            this.playIdleAnimation();
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
            this.playSwimmingAnimation();
        }
    }

    private applyModelBase(mesh: THREE.Group, model: THREE.Group, animations: THREE.AnimationClip[]) {
        mesh.add(model);
        this.setupModel(model);
        this.player = new AnimationPlayer(model, animations);
    }

    // Get the animal model and animations
    protected abstract getModelData(): { model: THREE.Group, animations: THREE.AnimationClip[] } | null;

    // The height for the model when in water
    protected abstract get heightInWater(): number;

    // e.g. derived class can scale and rotate model to desired size and facing
    protected abstract setupModel(model: THREE.Group): void;

    // For scaling animations to nominal speed
    protected getAnimationTimeScale(): number {
        return 1.0;
    }

    protected getIdleAnimationName(): string {
        return 'standing';
    }

    protected getWalkingAnimationName(): string {
        return 'walking';
    }

    protected getSwimmingAnimationName(): string {
        return this.getWalkingAnimationName();
    }

    protected playIdleAnimation() {
        this.player?.play({ name: this.getIdleAnimationName(), timeScale: this.getAnimationTimeScale(), randomizeLength: 0.2, startTime: -1 });
    }

    protected playWalkingAnimation(duration: number) {
        this.player?.play({ name: this.getWalkingAnimationName(), timeScale: this.getAnimationTimeScale(), randomizeLength: 0.2, startTime: -1 });
    }

    protected playSwimmingAnimation() {
        this.player?.play({ name: this.getSwimmingAnimationName(), timeScale: this.getAnimationTimeScale(), randomizeLength: 0.2, startTime: -1 });
    }

    update(dt: number) {
        if (this.player) {
            this.player.update(dt);
        }
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    setLandPosition(height: number, normal: THREE.Vector3, progress: number): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    shoreIdleMaybeStartEnteringWater(): boolean {
        const behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            this.heightInWater,
            this.aggressiveness
        );
        this.behavior = behavior;
        this.playWalkingAnimation(behavior.duration);
        return true;
    }

    enteringWaterDidComplete(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
        this.playSwimmingAnimation();
    }

    waterAttackUpdateIdle?(dt: number): void {
    }

    waterAttackUpdatePreparing?(dt: number): void {
    }

    waterAttackUpdateAttacking?(dt: number): void {
    }
}
