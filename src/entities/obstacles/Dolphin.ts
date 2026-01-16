import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { AnyAnimal, AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';

export class Dolphin extends Entity implements AnyAnimal {

    private aggressiveness: number = 1.0;
    private player: AnimationPlayer | null = null;
    private behavior: EntityBehavior | null = null;

    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(4.0, 4.0, 4.0); // Slightly larger than duckling
        //model.rotation.y = Math.PI;
        // model.position.y = -1.25; // Adjust based on model

        if (this.meshes.length > 0) {
            this.meshes[0].add(model);
        }

        this.player = new AnimationPlayer(model, animations);
    }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super();

        // Physics
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            angle: angle,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.5, 4.0),
            density: 5.0,
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: Entity.TYPE_OBSTACLE, subtype: 'dolphin', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        mesh.position.y = 0.2; // Slightly submerged or just at surface

        const dolphinData = Decorations.getDolphin();
        if (dolphinData) {
            this.applyModel(dolphinData.model, dolphinData.animations);
        }

        this.behavior = new AnimalUniversalBehavior(this, this.aggressiveness, { name: 'swimaway' });
        this.player?.play({ name: 'idle', timeScale: 1.0, randomizeLength: 0.2, startTime: -1.0 });
    }

    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    getHeight(): number {
        return this.meshes[0].position.y;
    }

    wasHitByPlayer() {
        // Dolphins might not be collectable, but let's handle hit anyway
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 });
    }

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        if (event.type === 'COMPLETED') {
            this.behavior = null;
        } else if (event.type === 'ACTIVE_TICK') {
            const state = event.animationState || 'ACTIVE';
            const isFleeing = state === DefaultSwimAwayLogic.ANIM_FLEEING;
            const animName = isFleeing ? 'swim' : 'idle';
            const timeScale = isFleeing ? 1.5 : 1.0;
            this.player?.play({ name: animName, state: state, timeScale: timeScale, randomizeLength: 0.1, startTime: -1.0 });
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

}
