import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { AnimalSwimAwayBehavior } from '../behaviors/AnimalSwimAwayBehavior';
import { AnyAnimal } from '../behaviors/AttackAnimal';

export class Duckling extends Entity implements AnyAnimal {

    private aggressiveness: number = 1.0;
    private player: AnimationPlayer | null = null;
    private behavior: EntityBehavior | null = null;

    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(1.0, 1.0, 1.0);
        model.rotation.y = Math.PI;
        model.position.y = -1.25;

        if (this.meshes.length > 0) {
            this.meshes[0].add(model);
        }

        this.player = new AnimationPlayer(model, animations);
        // Randomize speed between 1.8 and 2.2
        const timeScale = 1.8 + Math.random() * 0.4;
    }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super();

        // Ducklings can cause penalties when hit
        this.canCausePenalty = true;

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
            shape: planck.Box(1.5, 3.0), // Similar to hippo/alligator
            density: 5.0,
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'duckling', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        mesh.position.y = 0.5; // Raised by ~15% of model height

        const ducklingData = Decorations.getDuckling();
        if (ducklingData) {
            this.applyModel(ducklingData.model, ducklingData.animations);
        }

        this.behavior = new AnimalSwimAwayBehavior(this, this.aggressiveness);
        this.player.play({ name: 'bob', timeScale: 2.0, randomizeLength: 0.2, startTime: -1.0 });
    }

    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 });
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
