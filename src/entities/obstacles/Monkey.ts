import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalAnimations, AttackAnimalOptions } from './AttackAnimal';
import { AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
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

    private static readonly animations: AttackAnimalAnimations = {
        default: AttackAnimal.play({
            name: 'idle', state: 'idle',
            timeScale: 1.0, startTime: -1, randomizeLength: 0.2
        }),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.WALKING,
                    AnimalLogicPhase.ENTERING_WATER,
                ],
                play: AttackAnimal.play({
                    name: 'walk', state: 'walking',
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2
                })
            },
            {
                phases: [
                    AnimalLogicPhase.IDLE_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: AttackAnimal.play({
                    name: 'swim', state: 'swimming',
                    timeScale: 2.5, startTime: -1, randomizeLength: 0.2
                })
            },
        ]
    }

    protected getAnimations(): AttackAnimalAnimations {
        return Monkey.animations;
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
