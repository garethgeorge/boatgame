import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationParameters, AnimationPlayer, AnimationScript } from '../../core/AnimationPlayer';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { AnimalLogic, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior, ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { AnimalBehaviorConfig } from '../behaviors/AnimalBehaviorConfigs';
import { TerrainSlot } from '../../world/TerrainSlotMap';


export interface AnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: THREE.Vector3;
    aggressiveness?: number;
    disableLogic?: boolean;
    behavior?: AnimalBehaviorConfig;
    zRange: [number, number];
}


export interface AnimalPhysicsOptions {
    hull: number[];
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

export type AnimalClass =
    new (physicsEngine: PhysicsEngine, options: AnimalOptions) => Animal;


export abstract class Animal extends Entity implements AnyAnimal {
    private behavior: EntityBehavior | null = null;
    private player: AnimationPlayer | null = null;
    public currentSlot: TerrainSlot | null = null;

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        entityType: string,
        canCausePenalty: boolean,
        options: AnimalOptions,
        physicsOptions: AnimalPhysicsOptions
    ) {
        super();
        const {
            x,
            y,
            height,
            angle = 0,
            terrainNormal,
        } = options;

        this.canCausePenalty = canCausePenalty;

        this.setupModelMesh(height);

        this.setupPhysicsBody(physicsEngine, subtype, entityType, x, y, -angle, physicsOptions);

        if (terrainNormal)
            this.normalVector = terrainNormal.clone();
        else
            this.normalVector = new THREE.Vector3(0, 1, 0);

        this.setBehavior(null);
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
        let {
            hull,
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

        // Create polygon shape from hull points
        const vertices: planck.Vec2[] = [];
        for (let i = 0; i < hull.length; i += 2) {
            vertices.push(planck.Vec2(hull[i], hull[i + 1]));
        }

        physicsBody.createFixture({
            shape: planck.Polygon(vertices),
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

    //--- Behavior functions

    public setBehavior(behavior: EntityBehavior) {
        if (this.behavior && this.behavior.dispose) {
            this.behavior.dispose();
        }
        this.behavior = behavior;
        if (!this.behavior)
            this.playAnimationForPhase(null, AnimalLogicPhase.NONE);
    }

    //--- Animation functions

    /**
     * Returns a function to play the script
     */
    public static play(script: AnimationScript):
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            player.play(script);
        }
    }

    /**
     * Returns a function that calls the supplied factory function passing
     * it the logic phase duration.
     */
    public static playForDuration(factory: (duration: number) => AnimationScript):
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            const duration = logic?.getDuration() ?? 1.0;
            const script = factory(duration);
            player.play(script);
        }
    }

    public static stop():
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            player.stopAll();
        }
    }

    protected abstract getAnimations(): AnimalAnimations;

    public playAnimation(params: AnimationParameters) {
        this.player.play(params);
    }

    public playAnimationForPhase(logic: AnimalLogic, phase: AnimalLogicPhase) {
        const config = this.getAnimations();
        const playAnimation = config.animations?.find((animation) =>
            animation.phases.includes(phase)
        )?.play ?? config.default;
        if (playAnimation) {
            playAnimation(this.player, logic);
        }
    }

    public setAnimationThrottle(throttle: number): void {
        this.player?.setThrottle(throttle);
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

    dispose() {
        if (this.behavior && this.behavior.dispose) {
            this.behavior.dispose();
        }
        if (this.currentSlot) {
            this.currentSlot.isOccupied = false;
            this.currentSlot = null;
        }
        super.dispose();
    }

    protected abstract getHitBehaviorParams(): ObstacleHitBehaviorParams;

    wasHitByPlayer() {
        const params = this.getHitBehaviorParams();
        if (params) {
            this.destroyPhysicsBodies();
            this.setBehavior(new ObstacleHitBehavior(
                this.meshes,
                () => { this.shouldRemove = true },
                params));
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
