import * as planck from 'planck';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';
import { AttackPathResult } from './AttackPathStrategies';

export abstract class AttackLogic {
    abstract readonly name: string;
    abstract update(dt: number, originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, aggressiveness: number): void;
    abstract calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): AttackPathResult;
    abstract shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): boolean;
}
