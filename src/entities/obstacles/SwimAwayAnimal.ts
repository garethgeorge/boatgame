import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AnyAnimal, AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export interface SwimAwayAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    aggressiveness?: number;
}

export interface SwimAwayAnimalPhysicsOptions {
    halfWidth: number;
    halfLength: number;
    density?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
}

export interface SwimmerAnimationConfig {
    name: string;
    timeScale?: number;
    randomizeLength?: number;
    startTime?: number;
}

export abstract class SwimAwayAnimal extends Entity implements AnyAnimal {
    protected player: AnimationPlayer | null = null;
    protected behavior: EntityBehavior | null = null;
    protected aggressiveness: number;

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        entityType: string,
        options: SwimAwayAnimalOptions,
        physicsOptions: SwimAwayAnimalPhysicsOptions
    ) {
        super();

        const {
            x,
            y,
            height,
            angle = 0,
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

        this.aggressiveness = (options.aggressiveness !== undefined) ? options.aggressiveness : 1.0;

        // Physics
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            angle: angle,
            linearDamping: linearDamping,
            angularDamping: angularDamping
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(halfWidth, halfLength),
            density: density,
            friction: friction,
            restitution: restitution
        });

        physicsBody.setUserData({ type: entityType, subtype: subtype, entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        mesh.position.y = height;

        const modelData = this.getModelData();
        if (modelData) {
            this.applyModelBase(mesh, modelData.model, modelData.animations);
        }

        this.behavior = new AnimalUniversalBehavior(this, this.aggressiveness, { name: 'swimaway' });
    }

    private applyModelBase(mesh: THREE.Group, model: THREE.Group, animations: THREE.AnimationClip[]) {
        mesh.add(model);
        this.setupModel(model);
        this.player = new AnimationPlayer(model, animations);
    }

    protected abstract getModelData(): { model: THREE.Group, animations: THREE.AnimationClip[] } | null;

    protected abstract setupModel(model: THREE.Group): void;

    protected abstract getAnimationConfig(phase: AnimalLogicPhase): SwimmerAnimationConfig;

    protected getHitBehaviorOptions() {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }

    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    getHeight(): number {
        return this.meshes[0].position.y;
    }

    update(dt: number) {
        if (this.player) {
            this.player.update(dt);
        }
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, this.getHitBehaviorOptions());
    }

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        switch (event.type) {
            case 'LOGIC_STARTING': {
                this.playAnimation(event.logicPhase);
            }
            case 'LOGIC_FINISHED': {
                this.playAnimation(AnimalLogicPhase.IDLE_WATER);
                break;
            }
        }
    }

    private playAnimation(phase: AnimalLogicPhase) {
        const anim = this.getAnimationConfig(phase);
        this.player?.play({
            name: anim.name,
            state: 'IDLE',
            timeScale: anim.timeScale ?? 1.0,
            randomizeLength: anim.randomizeLength ?? 0.2,
            startTime: anim.startTime ?? -1.0
        });
    }
}
