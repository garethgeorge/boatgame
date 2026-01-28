import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { Entity } from '../../core/Entity';

export class Turtle extends Animal {
    public static readonly HEIGHT_IN_WATER: number = -0.8;
    public static readonly RADIUS: number = 1.5;

    constructor(physicsEngine: PhysicsEngine, options: AnimalOptions) {
        super(
            physicsEngine,
            'turtle',
            Entity.TYPE_OBSTACLE,
            true,
            options,
            {
                density: 8.0,
                friction: 0.1,
                linearDamping: 1.0,
                angularDamping: 1.0
            });

        this.setBehavior(SwimAwayBehaviorFactory.create(
            this,
            {
                heightInWater: Turtle.HEIGHT_IN_WATER,
                ...options
            }
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }

    protected getModelData() {
        return Decorations.getTurtle();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(2.0, 2.0, 2.0);
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'idle',
                timeScale: 0.5,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.ENTERING_WATER, AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'swim',
                        timeScale: 1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
