import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationParameters, AnimationPlayer } from '../../core/AnimationPlayer';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { WolfAttackLogic } from '../behaviors/logic/WolfAttackLogic';
import { EnteringWaterLogic } from '../behaviors/logic/EnteringWaterLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { AnimalLogic, AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export interface AttackAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: THREE.Vector3;
    onShore?: boolean;
    stayOnShore?: boolean;
    aggressiveness?: number;
    attackLogicName?: string;
    attackOffset?: planck.Vec2;
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

export interface AttackAnimalAnimations {
    default: (player: AnimationPlayer, logic: AnimalLogic) => void,
    animations?: {
        phases: AnimalLogicPhase[],
        play: (player: AnimationPlayer, logic: AnimalLogic) => void
    }[];
}

export abstract class AttackAnimal extends Entity implements AnyAnimal {
    protected player: AnimationPlayer | null = null;
    protected behavior: EntityBehavior | null = null;
    protected aggressiveness: number;
    protected attackLogicName: string | undefined;
    protected attackOffset: planck.Vec2;

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
            stayOnShore = false,
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
        this.attackLogicName = options.attackLogicName;
        this.attackOffset = options.attackOffset || planck.Vec2(0, -halfLength);
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
        physicsBody.setUserData({ type: Entity.TYPE_OBSTACLE, subtype: subtype, entity: this });
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
                const idleConfig = this.getOnShoreConfig();
                this.behavior = new AnimalUniversalBehavior(this, this.aggressiveness, idleConfig, this.attackOffset);
            } else {
                this.playAnimation(null, AnimalLogicPhase.NONE);
            }
        } else {
            const waterConfig = this.getInWaterConfig();
            this.behavior = new AnimalUniversalBehavior(this, this.aggressiveness, waterConfig, this.attackOffset);
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

    // Does the animal jump into the water?
    protected get jumpsIntoWater(): boolean {
        return false;
    }

    // e.g. derived class can scale and rotate model to desired size and facing
    protected abstract setupModel(model: THREE.Group): void;

    protected static play(params: AnimationParameters):
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            player.play(params);
        }
    }

    protected abstract getAnimations(): AttackAnimalAnimations;

    protected playAnimation(logic: AnimalLogic, phase: AnimalLogicPhase) {
        const config = this.getAnimations();
        const playAnimation = config.animations?.find((animation) =>
            animation.phases.includes(phase)
        )?.play ?? config.default;
        if (playAnimation) {
            playAnimation(this.player, logic);
        }
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

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    getOnShoreConfig(): AnimalLogicConfig {
        const idleConfig: AnimalLogicConfig = {
            name: ShoreIdleLogic.NAME,
            params: {
                nextLogicConfig: this.getEnterWaterConfig(),
                maybeSwitchBehavior: () => this.shoreIdleMaybeSwitchBehavior()
            }
        };
        return idleConfig;
    }

    getEnterWaterConfig(): AnimalLogicConfig {
        // Create an entering water logic that chains into the final attack/flight logic
        return {
            name: EnteringWaterLogic.NAME,
            params: {
                targetWaterHeight: this.heightInWater,
                jump: this.jumpsIntoWater,
                nextLogicConfig: this.getInWaterConfig()
            }
        };
    }

    getInWaterConfig(): AnimalLogicConfig {
        return { name: this.attackLogicName || WolfAttackLogic.NAME };
    }

    /**
     * Can be overriden in derived classes to change behavior while
     * idle.
     */
    shoreIdleMaybeSwitchBehavior(): AnimalLogicConfig | null {
        return null; // Default: stay in idle
    }

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        switch (event.type) {
            case 'LOGIC_STARTING': {
                this.playAnimation(event.logic, event.logicPhase);
                break;
            }
            case 'LOGIC_FINISHED': {
                this.playAnimation(null, AnimalLogicPhase.NONE);
                break;
            }
        }
    }
}
