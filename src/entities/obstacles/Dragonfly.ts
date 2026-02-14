import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../Entity';
import { FlyingBehaviorFactory } from '../behaviors/FlyingBehaviorFactory';

import { EntityMetadata } from '../EntityMetadata';
import { FlyingBehaviorConfig } from '../behaviors/AnimalBehaviorConfigs';

export class Dragonfly extends Animal {
    public static readonly MODEL_PARAMS = { scale: 2.25 };
    public static readonly RADIUS: number = EntityMetadata.dragonfly.radius;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'dragonfly', Entity.TYPE_OBSTACLE, false,
            options,
            {
                hull: EntityMetadata.dragonfly.hull,
                density: 0.1,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.create(
            this,
            options.behavior as FlyingBehaviorConfig,
            options
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }

    protected getModelData() {
        return Decorations.getDragonfly();
    }

    protected setupModel(model: THREE.Group): void {
        const scale = Dragonfly.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
        // Dragonflies usually have their front at -Z in models, 
        // but if it's flipped we might need Math.PI.
        model.rotation.y = 0;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'flying',
                timeScale: 4.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            })
        };
    }
}
