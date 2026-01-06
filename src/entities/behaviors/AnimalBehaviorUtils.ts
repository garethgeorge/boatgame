import * as planck from 'planck';

export interface AnimalAttackParams {
    startAttackDistance: number,
    endAttackDistance: number,
    attackSpeed: number,
    turningSpeed: number
}

export class AnimalBehaviorUtils {
    /**
     * If the boat has no bottles, they should ignore it completely.
     * Otherwise, distance thresholds and speed of attack scale with the number of bottles.
     */
    public static getAgressivenessMultiplier(bottles: number): number {
        if (bottles === 0) return 0;
        // 1.0 at 1 bottle, scaling up linearly. 
        // Example: 2.0 at 10 bottles.
        return 1.0 + (bottles - 1) * 0.1;
    }

    public static evaluateNoticeBoatDistance(aggressiveness: number,
        bottles: number, minDistance: number = 50.0): number {
        const mult = bottles < 0 ? 1.0 : this.getAgressivenessMultiplier(bottles);
        if (mult === 0) return 0;

        // Default base distance: 50 + 50 * aggressiveness
        const baseDist = minDistance * (1.0 + aggressiveness);
        return baseDist * mult;
    }

    public static evaluateAttackParams(aggressiveness: number, bottles: number): AnimalAttackParams {
        const mult = this.getAgressivenessMultiplier(bottles);

        // Base distance from original WaterBehavior: 30 + 60 * aggressiveness
        const startAttackDistance = (30 + 60 * aggressiveness) * mult;
        const endAttackDistance = startAttackDistance + 20;

        // Base speed from original WaterBehavior: 1 + 3 * aggressiveness
        const attackSpeed = (1 + 3 * aggressiveness) * mult * 5.0;

        const turningSpeed = 2.0 + (aggressiveness * 3.0);

        return { startAttackDistance, endAttackDistance, attackSpeed, turningSpeed };
    }

    public static setCollisionMask(body: planck.Body, maskBits: number) {
        for (let b = body.getFixtureList(); b; b = b.getNext()) {
            b.setFilterData({
                categoryBits: b.getFilterCategoryBits(),
                maskBits: maskBits,
                groupIndex: b.getFilterGroupIndex()
            });
        }
    }
}
