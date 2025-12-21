import * as planck from 'planck';
import { TransformNode, Vector3, AnimationGroup } from '@babylonjs/core';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';

export interface AttackAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: Vector3;
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

export abstract class AttackAnimal extends Entity {
    protected behavior: EntityBehavior | null = null;
    protected aggressiveness: number;

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        options: AttackAnimalOptions,
        physicsOptions: AttackAnimalPhysicsOptions
    ) {
        super();

        const { x, y, density = 5.0, friction = 0.1, restitution = 0.0 } = options as any; // logic simplified

        this.aggressiveness = Math.random();
        this.canCausePenalty = true;

        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(options.x, options.y),
            angle: -(options.angle || 0),
            linearDamping: physicsOptions.linearDamping || 2.0,
            angularDamping: physicsOptions.angularDamping || 1.0
        });
        physicsBody.createFixture({
            shape: planck.Box(physicsOptions.halfWidth, physicsOptions.halfLength),
            density: physicsOptions.density,
            friction: physicsOptions.friction,
            restitution: physicsOptions.restitution
        });
        physicsBody.setUserData({ type: 'obstacle', subtype: subtype, entity: this });
        this.physicsBodies.push(physicsBody);

        const mesh = new TransformNode("attackAnimal");
        this.meshes.push(mesh);

        // Setup model
        const modelData = this.getModelData();
        if (modelData) {
            modelData.model.parent = mesh;
            this.setupModel(modelData.model, modelData.animations);
        }

        mesh.position.y = options.height;

        if (options.terrainNormal)
            this.normalVector = options.terrainNormal.clone();
        else
            this.normalVector = new Vector3(0, 1, 0);

        if (options.onShore) {
            this.behavior = new AttackAnimalShoreIdleBehavior(this as any, this.aggressiveness);
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this as any, this.aggressiveness);
        }
    }

    // Get the animal model and animations
    protected abstract getModelData(): { model: TransformNode, animations: AnimationGroup[] } | null;

    // The height for the model when in water
    protected abstract get heightInWater(): number;

    // e.g. derived class can scale and rotate model to desired size and facing
    protected abstract setupModel(model: TransformNode, animations: AnimationGroup[]): void;

    update(dt: number) {
        if (this.behavior) {
            this.behavior.update(dt);
        }
        this.sync();
    }

    setLandPosition(height: number, normal: Vector3, progress: number): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector = normal.clone();
    }

    // Stubs for interface compliance
    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    wasHitByPlayer() {
        // Attack animals can react to being hit? 
    }

    shoreIdleMaybeStartEnteringWater(): boolean {
        if (this.behavior instanceof AttackAnimalShoreIdleBehavior) {
            this.behavior = new AttackAnimalEnteringWaterBehavior(this as any, this.heightInWater, this.aggressiveness);
            return true;
        }
        return false;
    }

    enteringWaterDidComplete(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this as any, this.aggressiveness);
    }
}
