import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackBehaviorFactory } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';

export class TRex extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -3.0;
    public static readonly RADIUS: number = 5.0;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'trex', Entity.TYPE_OBSTACLE, true,
            options,
            {
                density: 10.0,
                friction: 0.1
            });

        this.setBehavior(AttackBehaviorFactory.create(this,
            {
                heightInWater: TRex.HEIGHT_IN_WATER,
                jumpsIntoWater: false,
                snoutOffset: 4.0,
                ...options,
            })
        );
    }

    protected getModelData() {
        return Decorations.getTRex();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(6.0, 6.0, 6.0);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AnimalAnimations = {
        default: AttackAnimal.play({
            name: 'standing',
            timeScale: 1.0, startTime: -1, randomizeLength: 0.2,
            repeat: Infinity
        }),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.ENTERING_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: AttackAnimal.play({
                    name: 'walking',
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return TRex.animations;
    }
}
