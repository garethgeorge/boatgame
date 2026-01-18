import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';
import { AnimalLogic, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { AnimalAnimations } from './Animal';

export class Moose extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -3.0;

    protected get heightInWater(): number {
        return Moose.HEIGHT_IN_WATER;
    }

    protected get jumpsIntoWater(): boolean {
        return true;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'moose', options, {
            halfWidth: 1.5,
            halfLength: 2.5,
            density: 5.0,
            friction: 0.3,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
    }

    protected getModelData() {
        return Decorations.getMoose();
    }

    protected setupModel(model: THREE.Group): void {
        model.position.y = 3.0;
        model.scale.set(0.1, 0.1, 0.1);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AnimalAnimations = {
        default: AttackAnimal.play({
            name: 'idle', state: 'idle',
            timeScale: 1.0, startTime: -1, randomizeLength: 0.2
        }),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.ENTERING_WATER,
                ],
                play: (player: AnimationPlayer, logic: AnimalLogic) => {
                    const duration = logic?.getDuration() ?? 1.0;
                    if (duration > 0.5) {
                        const startTimeScale = 0.5;
                        const endTimeScale = 0.5;
                        const fallDuration = duration - startTimeScale - endTimeScale;

                        player.playSequence([
                            { name: 'jump_start', duration: startTimeScale },
                            { name: 'jump_fall', duration: fallDuration },
                            { name: 'jump_end', duration: endTimeScale }
                        ]);
                    } else {
                        player.play({ name: 'walk', startTime: -1 });
                    }
                }
            },
            {
                phases: [
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: AttackAnimal.play({
                    name: 'walk', state: 'swimming',
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return Moose.animations;
    }
}
