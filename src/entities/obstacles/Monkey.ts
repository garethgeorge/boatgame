import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';
import { AnimalLogicConfig } from '../behaviors/logic/AnimalLogic';
import { ShoreWalkLogic } from '../behaviors/logic/ShoreWalkLogic';

export class Monkey extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -1.7;

    protected get heightInWater(): number {
        return Monkey.HEIGHT_IN_WATER;
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

    shoreIdleMaybeSwitchBehavior(): AnimalLogicConfig | null {
        // random choice between shore walk and dance/dont
        const rand = Math.random();
        if (rand < 0.33) {
            const walkDistance = 10 + Math.random() * 10;
            const speed = 0.8 + Math.random() * 0.4;

            // go for a walk then back to idle
            return {
                name: ShoreWalkLogic.NAME,
                params: {
                    walkDistance,
                    speed,
                    nextLogicConfig: this.getOnShoreConfig()
                }
            };
        } else if (rand < 0.67) {
            this.player?.play({ name: 'dance', timeScale: 1.0 });
            return null;
        } else {
            this.player?.play({ name: 'idle', timeScale: 1.0 });
            return null;
        }
    }
}
