import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';
import { FlyingBehaviorFactory } from '../behaviors/FlyingBehaviorFactory';

import { EntityMetadata } from '../EntityMetadata';

export class Dragonfly extends Animal {
    public static readonly MODEL_SCALE: number = 2.25;
    public static readonly RADIUS: number = EntityMetadata.dragonfly.radius;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'dragonfly', Entity.TYPE_OBSTACLE, false,
            options,
            {
                density: 0.1,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createWandering(
            this,
            {
                noticeDistance: 60.0,
                flightSpeed: 40.0,
                flightHeight: 4.0,
                buzzDuration: 2.0,
                buzzHeight: 1.5,
                buzzOffset: 3.0,
                wanderRadius: 10.0,
                ...options,
            }
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }

    protected getModelData() {
        return Decorations.getDragonfly();
    }

    protected setupModel(model: THREE.Group): void {
        const scale = Dragonfly.MODEL_SCALE;
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
