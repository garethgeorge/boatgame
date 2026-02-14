import * as THREE from 'three';
import { Entity } from '../Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';

import { EntityMetadata } from '../EntityMetadata';

export class PenguinKayak extends Animal {
    public static readonly HEIGHT_IN_WATER: number = 0.5;
    public static readonly MODEL_PARAMS = { scale: 2.0, angle: Math.PI / 2.0 };
    public static readonly RADIUS: number = EntityMetadata.penguinKayak.radius;

    constructor(physicsEngine: PhysicsEngine, options: AnimalOptions) {
        super(
            physicsEngine,
            'penguinKayak',
            Entity.TYPE_OBSTACLE,
            false,
            { height: 0.5, ...options },
            {
                hull: EntityMetadata.penguinKayak.hull
            });

        this.setBehavior(SwimAwayBehaviorFactory.create(
            this,
            options
        ));
    }

    protected getModelData() {
        return Decorations.getPenguinKayak();
    }

    protected setupModel(model: THREE.Group) {
        const { scale, angle } = PenguinKayak.MODEL_PARAMS;
        model.scale.set(scale, scale, scale);
        model.rotation.y = angle;
        model.position.y = -0.4;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'paddling',
                timeScale: 2.0, randomizeLength: 0.2, startTime: -1.0,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'paddling',
                        timeScale: 3.5, randomizeLength: 0.2, startTime: -1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
