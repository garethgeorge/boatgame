import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';
import { FlyingBehaviorFactory } from '../behaviors/FlyingBehaviorFactory';

export class Pterodactyl extends Animal {
    public static readonly RADIUS: number = 2.0;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'pterodactyl', Entity.TYPE_OBSTACLE, false,
            options,
            {
                density: 1.0,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createShoreLanding(
            this,
            {
                noticeDistance: 200.0,
                flightSpeed: 30.0,
                ...options,
            }
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }

    protected getModelData() {
        return Decorations.getPterodactyl();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'standing',
                timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                    ],
                    play: Animal.play({
                        name: 'flying',
                        timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
