import * as planck from 'planck';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';

export abstract class AttackLogic {
    abstract readonly name: string;
    abstract update(dt: number, attackPointWorld: planck.Vec2, targetBody: planck.Body, aggressiveness: number): void;
    abstract calculateTarget(attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): planck.Vec2;
    abstract shouldAbort(attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): boolean;
}
