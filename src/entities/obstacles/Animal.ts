import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationParameters, AnimationPlayer } from '../../core/AnimationPlayer';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { AnimalLogic, AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { ObstacleHitBehavior, ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';

export interface AnimalPhysicsOptions {
    halfWidth: number;
    halfLength: number;
    density?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
}

export interface AnimalAnimations {
    default: (player: AnimationPlayer, logic: AnimalLogic) => void,
    animations?: {
        phases: AnimalLogicPhase[],
        play: (player: AnimationPlayer, logic: AnimalLogic) => void
    }[];
}

export abstract class Animal extends Entity implements AnyAnimal {
    private behavior: EntityBehavior | null = null;
    private player: AnimationPlayer | null = null;

    constructor() {
        super();
    }

    protected setupPhysicsBody(
        physicsEngine: PhysicsEngine,
        subtype: string,
        entityType: string,
        x: number,
        y: number,
        angle: number,
        physicsOptions: AnimalPhysicsOptions
    ): planck.Body {
        const {
            halfWidth,
            halfLength,
            density = 5.0,
            friction = 0.1,
            restitution = 0.0,
            linearDamping = 2.0,
            angularDamping = 1.0
        } = physicsOptions;

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

        physicsBody.setUserData({ type: entityType, subtype: subtype, entity: this });
        this.physicsBodies.push(physicsBody);

        return physicsBody;
    }

    //--- Graphics model functions

    protected abstract getModelData(): { model: THREE.Group, animations: THREE.AnimationClip[] } | null;

    protected abstract setupModel(model: THREE.Group): void;

    protected setupModelMesh(height: number) {
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        const modelData = this.getModelData();
        if (modelData) {
            mesh.add(modelData.model);
            this.setupModel(modelData.model);
            this.player = new AnimationPlayer(modelData.model, modelData.animations);
        }

        mesh.position.y = height;
    }

    //--- Animation functions

    protected static play(params: AnimationParameters):
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            player.play(params);
        }
    }

    protected static stop():
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            player.stopAll();
        }
    }

    protected abstract getAnimations(): AnimalAnimations;

    protected playAnimation(params: AnimationParameters) {
        this.player.play(params);
    }

    private playAnimationForPhase(logic: AnimalLogic, phase: AnimalLogicPhase) {
        const config = this.getAnimations();
        const playAnimation = config.animations?.find((animation) =>
            animation.phases.includes(phase)
        )?.play ?? config.default;
        if (playAnimation) {
            playAnimation(this.player, logic);
        }
    }

    //--- behavior

    protected setupBehavior(
        logicConfig: AnimalLogicConfig,
        aggressiveness: number,
        snoutOffset?: planck.Vec2
    ) {
        this.behavior = new AnimalUniversalBehavior(this, aggressiveness, logicConfig, snoutOffset);
    }

    //--- Entity

    update(dt: number) {
        if (this.player) {
            this.player.update(dt);
        }
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

    abstract getHitBehaviorParams(): ObstacleHitBehaviorParams;

    wasHitByPlayer() {
        const params = this.getHitBehaviorParams();
        if (params) {
            this.destroyPhysicsBodies();
            this.behavior = new ObstacleHitBehavior(
                this.meshes,
                () => { this.shouldRemove = true },
                params);
        }
    }

    //--- AnyAnimal interface

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
        if (this.normalVector) {
            this.normalVector.copy(normal);
        } else {
            this.normalVector = normal.clone();
        }
    }

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        switch (event.type) {
            case 'LOGIC_STARTING': {
                this.playAnimationForPhase(event.logic, event.logicPhase);
                break;
            }
            case 'LOGIC_FINISHED': {
                this.playAnimationForPhase(null, AnimalLogicPhase.NONE);
                break;
            }
        }
    }
}
