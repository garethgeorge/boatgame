import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';
import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { AnimalShoreWalkBehavior } from '../behaviors/AnimalShoreWalkBehavior';
import { AttackAnimalShoreWalk } from '../behaviors/AttackAnimalBehavior';

export class Monkey extends AttackAnimal implements AttackAnimalShoreWalk {

    protected get heightInWater(): number {
        return -1.7;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'monkey', options, {
            halfWidth: 1.0,
            halfLength: 1.0,
            density: 5.0,
            friction: 0.3,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
    }

    protected getModelData() {
        return Decorations.getMonkey();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(0.025, 0.025, 0.025);
        model.rotation.y = Math.PI;
    }

    protected getIdleAnimationName(): string {
        return 'idle';
    }

    protected getWalkingAnimationName(): string {
        return 'walk';
    }

    protected getSwimmingAnimationName(): string {
        return 'swim';
    }

    protected getAnimationTimeScale(): number {
        return 1.0;
    }

    protected playSwimmingAnimation(): void {
        this.player?.play({ name: this.getSwimmingAnimationName(), timeScale: 2.5, randomizeLength: 0.2, startTime: -1 });
    }


    shoreIdleMaybeSwitchBehavior(): void {
        // random choice between shore walk and dance/dont
        const rand = Math.random();
        if (rand < 0.5) {
            this.shouldStartShoreWalk();
        } else {
            this.player?.play({ name: 'dance', timeScale: 1.0 });
        }
    }

    private shouldStartShoreWalk(): void {
        // Create shore walk behavior with random distance and speed
        const walkDistance = 10 + Math.random() * 10; // 10-20 meters
        const speed = 0.8 + Math.random() * 0.4; // 0.8-1.2x speed

        this.behavior = new AnimalShoreWalkBehavior(
            this,
            walkDistance,
            speed
        );

        this.player?.play({ name: 'walk', timeScale: 1.0 });
    }

    shoreWalkDidComplete(): void {
        // Return to idle behavior after completing shore walk
        this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
        this.player?.play({ name: 'idle', timeScale: 1.0 });
    }
}
