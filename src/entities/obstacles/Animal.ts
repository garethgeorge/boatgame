import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationParameters, AnimationPlayer } from '../../core/AnimationPlayer';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { WolfAttackLogic } from '../behaviors/logic/WolfAttackLogic';
import { EnteringWaterLogic } from '../behaviors/logic/EnteringWaterLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { AnimalLogic, AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export interface AnimalAnimations {
    default: (player: AnimationPlayer, logic: AnimalLogic) => void,
    animations?: {
        phases: AnimalLogicPhase[],
        play: (player: AnimationPlayer, logic: AnimalLogic) => void
    }[];
}

export abstract class Animal extends Entity implements AnyAnimal {
    protected player: AnimationPlayer | null = null;

    constructor() {
        super();
    }

    protected static play(params: AnimationParameters):
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            player.play(params);
        }
    }

    protected static stop():
        (player: AnimationPlayer, logic: AnimalLogic) => void {
        return (player: AnimationPlayer, logic: AnimalLogic) => {
            player.stopAll();
        }
    }

    protected abstract getAnimations(): AnimalAnimations;

    protected playAnimation(logic: AnimalLogic, phase: AnimalLogicPhase) {
        const config = this.getAnimations();
        const playAnimation = config.animations?.find((animation) =>
            animation.phases.includes(phase)
        )?.play ?? config.default;
        if (playAnimation) {
            playAnimation(this.player, logic);
        }
    }

    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    getHeight(): number {
        return this.meshes[0].position.y;
    }

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        switch (event.type) {
            case 'LOGIC_STARTING': {
                this.playAnimation(event.logic, event.logicPhase);
                break;
            }
            case 'LOGIC_FINISHED': {
                this.playAnimation(null, AnimalLogicPhase.NONE);
                break;
            }
        }
    }
}
