import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { DefaultFlightLogic } from '../behaviors/logic/DefaultFlightLogic';
import { AnimalBehaviorEvent, AnyAnimal } from '../behaviors/AnimalBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';

export interface AnimationConfig {
    name: string;
    timeScale?: number;
}

export interface FlyingAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: THREE.Vector3;
    aggressiveness?: number;
    flightSpeed?: number;
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

export abstract class FlyingAnimal extends Entity implements AnyAnimal {
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
            flightSpeed = 1.0
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

        const idleConfig: AnimalLogicConfig = {
            name: ShoreIdleLogic.NAME,
            params: {
                minNoticeDistance: 200.0,
                ignoreBottles: true,
                nextLogicConfig: {
                    name: DefaultFlightLogic.NAME,
                    params: { flightSpeed }
                }
            }
        };
        this.behavior = new AnimalUniversalBehavior(this, this.aggressiveness, idleConfig);
        this.playIdleAnimation();
    }

    private applyModelBase(mesh: THREE.Group, model: THREE.Group, animations: THREE.AnimationClip[]) {
        mesh.add(model);
        this.setupModel(model);
        this.player = new AnimationPlayer(model, animations);
    }

    protected abstract getModelData(): { model: THREE.Group, animations: THREE.AnimationClip[] } | null;

    protected abstract setupModel(model: THREE.Group): void;

    protected abstract getIdleAnimationName(): AnimationConfig;

    protected abstract getFlightAnimationName(): AnimationConfig;

    protected playIdleAnimation() {
        const config = this.getIdleAnimationName();
        this.player?.play({
            name: config.name,
            state: 'IDLE',
            timeScale: config.timeScale ?? 1.0,
            randomizeLength: 0.2,
            startTime: -1
        });
    }

    protected playFlightAnimation() {
        const config = this.getFlightAnimationName();
        this.player?.play({
            name: config.name,
            state: AnimalLogicPhase.FLYING,
            timeScale: config.timeScale ?? 1.0,
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

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        switch (event.type) {
            case 'LOGIC_STARTING': {
                switch (event.logicPhase) {
                    case AnimalLogicPhase.FLYING: {
                        this.playFlightAnimation();
                        break;
                    }
                    case AnimalLogicPhase.PREPARING_ATTACK:
                    case AnimalLogicPhase.ATTACKING: {
                        this.playFlightAnimation();
                        break;
                    }
                    default: {
                        this.playIdleAnimation();
                        break;
                    }
                }
            }
            case 'LOGIC_FINISHED': {
                this.playIdleAnimation();
                break;
            }
        }
    }

    wasHitByPlayer() {
        // For now, same as attack animal
        // this.destroyPhysicsBodies();
        // this.shouldRemove = true;
    }
}
