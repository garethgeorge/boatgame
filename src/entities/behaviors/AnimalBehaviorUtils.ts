import * as planck from 'planck';

export interface AnimalAttackParams {
    startAttackDistance: number,
    endAttackDistance: number,
    attackSpeed: number,
    turningSpeed: number,
    turningSmoothing: number
}

export class AnimalBehaviorUtils {
    /**
     * The effective aggressiveness given a base value and number of collectables.
     * numCollectables < 0 => ignore them
     */
    public static effectiveAggressiveness(baseValue: number, numCollectables: number): number {
        if (numCollectables < 0.0) {
            return baseValue;
        } else {
            return (baseValue + Math.min(numCollectables / 20.0, 1.0)) * 0.5;
        }
    }

    /**
     * Distance from which to notice the boat. Between 1 and 3 times the
     * min distance.
     * Default min distance of 50 gives a range from 50 to 150 m
     * Returns 0 if there are no collectables indicating boat is ignored.
     */
    public static evaluateNoticeBoatDistance(aggressiveness: number,
        numCollectables: number, minDistance: number): number {
        if (numCollectables === 0.0) {
            return 0.0;
        }
        const aggro = this.effectiveAggressiveness(aggressiveness, numCollectables);
        return minDistance + 2.0 * minDistance * aggro;
    }

    /**
     * Attack parameters.
     * Start between 1 and 3 times min
     * Break off if 20 m further away than start
     * Speed from 10 to 50 m/s
     * Turning from pi to 4 pi radians/s
     * Default min distance of 30 gives start range from 30 to 90 m
     */
    public static evaluateAttackParams(aggressiveness: number,
        numCollectables: number, minDistance: number): AnimalAttackParams {
        const aggro = this.effectiveAggressiveness(aggressiveness, numCollectables);

        // Base distance from original WaterBehavior: 30 + 60 * aggressiveness
        const startAttackDistance = minDistance + 2.0 * minDistance * aggro;
        const endAttackDistance = startAttackDistance + 20;

        // Speed from 10 to 50 m/s
        const attackSpeed = 10.0 + 40.0 * aggro;

        // Turning from pi to 8 pi radians/s
        const turningSpeed = Math.PI * (1.0 + 3.0 * aggro);
        const turningSmoothing = 0.1 + 0.4 * aggro;

        return { startAttackDistance, endAttackDistance, attackSpeed, turningSpeed, turningSmoothing };
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
