
export class AttackAnimalUtils {
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

    public static evaluateEnterWaterDistance(aggressiveness: number, bottles: number): number {
        const mult = this.getAgressivenessMultiplier(bottles);
        if (mult === 0) return 0;

        // Base distance from original ShoreIdleBehavior: 50 + 50 * aggressiveness
        const baseDist = 50 + 50 * aggressiveness;
        return baseDist * mult;
    }

    public static evaluateStartAttackDistance(aggressiveness: number, bottles: number): number {
        const mult = this.getAgressivenessMultiplier(bottles);
        if (mult === 0) return 0;

        // Base distance from original WaterBehavior: 30 + 60 * aggressiveness
        const baseDist = 30 + 60 * aggressiveness;
        return baseDist * mult;
    }

    public static evaluateAttackSpeed(aggressiveness: number, bottles: number): number {
        const mult = this.getAgressivenessMultiplier(bottles);
        if (mult === 0) return 0;

        // Base speed from original WaterBehavior: 1 + 3 * aggressiveness
        const baseSpeed = 1 + 3 * aggressiveness;
        return baseSpeed * mult;
    }
}
