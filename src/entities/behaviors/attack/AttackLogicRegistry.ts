import { AttackLogic } from './AttackLogic';
import { WolfAttackLogic } from './WolfAttackLogic';

export class AttackLogicRegistry {
    private static logics: Map<string, () => AttackLogic> = new Map();

    static {
        this.register('wolf', () => new WolfAttackLogic());
    }

    public static register(name: string, factory: () => AttackLogic) {
        this.logics.set(name, factory);
    }

    public static create(name: string): AttackLogic {
        const factory = this.logics.get(name);
        if (!factory) {
            // Fallback to wolf if not found, or could throw error
            console.warn(`AttackLogic "${name}" not found, falling back to "wolf"`);
            return new WolfAttackLogic();
        }
        return factory();
    }
}
