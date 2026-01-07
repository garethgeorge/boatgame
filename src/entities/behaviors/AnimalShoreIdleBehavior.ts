import * as planck from 'planck';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';
import { AnimalShoreIdle } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalBehaviorUtils } from './AnimalBehaviorUtils';

export class AnimalShoreIdleBehavior implements EntityBehavior {
    private entity: AnimalShoreIdle;
    private aggressiveness: number;
    private minNoticeDistance: number;
    private ignoreBottles: boolean;

    constructor(
        entity: AnimalShoreIdle,
        aggressiveness: number,
        minNoticeDistance: number = 50.0,
        ignoreBottles: boolean = false
    ) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
        this.ignoreBottles = ignoreBottles;
        this.minNoticeDistance = minNoticeDistance;
    }

    update(dt: number) {
        const bottles = this.ignoreBottles ? -1 : Boat.getBottleCount();
        const noticeBoatDistance = AnimalBehaviorUtils.evaluateNoticeBoatDistance(this.aggressiveness, bottles, this.minNoticeDistance);

        if (noticeBoatDistance <= 0) {
            this.perhapsShouldSwitchBehavior(dt);
        } else {
            if (!this.perhapsShouldNoticeBoat(dt, noticeBoatDistance)) {
                this.perhapsShouldSwitchBehavior(dt);
            }
        }
    }

    private perhapsShouldNoticeBoat(dt: number, noticeBoatDistance: number): boolean {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return false;

        const pos = physicsBody.getPosition();
        const target = targetBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        // Activate when boat is within distance
        if (dist < noticeBoatDistance) {
            // Let the entity decide what to do (e.g., create entering water behavior)
            return this.entity.shoreIdleMaybeNoticeBoat?.();
        }

        return false;
    }

    private perhapsShouldSwitchBehavior(dt: number) {
        // Probability such that average time is 5 seconds
        const probability = dt / 5.0;
        if (Math.random() < probability) {
            this.entity.shoreIdleMaybeSwitchBehavior?.();
        }
    }
}
