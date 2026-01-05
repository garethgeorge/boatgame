import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { AnimalShoreIdle, AnimalFlight } from '../behaviors/AnimalBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AnimalShoreIdleBehavior } from '../behaviors/AnimalShoreIdleBehavior';
import { AnimalFlightBehavior } from '../behaviors/AnimalFlightBehavior';

export interface FlyingAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: THREE.Vector3;
    aggressiveness?: number;
    minNoticeDistance?: number;
}

export interface FlyingAnimalPhysicsOptions {
    halfWidth: number;
    halfLength: number;
    density?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
}

export abstract class FlyingAnimal extends Entity implements AnimalShoreIdle, AnimalFlight {
    protected player: AnimationPlayer | null = null;
    protected behavior: EntityBehavior | null = null;
    protected aggressiveness: number;

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        options: FlyingAnimalOptions,
        physicsOptions: FlyingAnimalPhysicsOptions
    ) {
        super();

        const {
            x,
            y,
            height,
            angle = 0,
            terrainNormal,
            minNoticeDistance = 50.0
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

        this.aggressiveness = (options.aggressiveness !== undefined) ? options.aggressiveness : Math.random();

        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            angle: angle,
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

        this.behavior = new AnimalShoreIdleBehavior(this, this.aggressiveness, true, minNoticeDistance);
        this.playIdleAnimation();
    }

    private applyModelBase(mesh: THREE.Group, model: THREE.Group, animations: THREE.AnimationClip[]) {
        mesh.add(model);
        this.setupModel(model);
        this.player = new AnimationPlayer(model, animations);
    }

    protected abstract getModelData(): { model: THREE.Group, animations: THREE.AnimationClip[] } | null;

    protected abstract setupModel(model: THREE.Group): void;

    protected abstract getIdleAnimationName(): string;

    protected abstract getFlightAnimationName(): string;

    protected playIdleAnimation() {
        this.player?.play({
            name: this.getIdleAnimationName(),
            timeScale: 1.0,
            randomizeLength: 0.2,
            startTime: -1
        });
    }

    protected playFlightAnimation() {
        this.player?.play({
            name: this.getFlightAnimationName(),
            timeScale: 1.0,
            randomizeLength: 0.2,
            startTime: -1
        });
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

    getHeight(): number {
        return this.meshes[0].position.y;
    }

    setExplictPosition(height: number, normal: THREE.Vector3): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    shoreIdleMaybeNoticeBoat(): boolean {
        if (this.meshes.length > 0) {
            this.behavior = new AnimalFlightBehavior(this);
            this.playFlightAnimation();
            return true;
        }
        return false;
    }

    flightDidComplete(): void {
        // Remove or land? User said "just fly to opposite bank". 
        // Let's just remove for now or let it sit? 
        // For now let's just mark it to be removed to keep it simple, or it will just hover there.
        // Actually, let's just stop the behavior.
        this.behavior = null;
        this.playIdleAnimation();
    }

    wasHitByPlayer() {
        // For now, same as attack animal
        // this.destroyPhysicsBodies();
        // this.shouldRemove = true;
    }
}
