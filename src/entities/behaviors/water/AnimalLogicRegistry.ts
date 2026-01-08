import { AnimalLogic } from './AnimalLogic';
import { WolfAttackLogic } from './WolfAttackLogic';
import { AmbushAttackLogic } from './AmbushAttackLogic';
import { DefaultSwimAwayLogic } from './DefaultSwimAwayLogic';

export class AnimalLogicRegistry {
    private static factories: Map<string, () => AnimalLogic> = new Map();

    static {
        this.register('wolf', () => new WolfAttackLogic());
        this.register('ambush', () => new AmbushAttackLogic());
        this.register('swimaway', () => new DefaultSwimAwayLogic());
    }

    public static register(name: string, factory: () => AnimalLogic) {
        this.factories.set(name, factory);
    }

    public static create(name: string): AnimalLogic {
        const factory = this.factories.get(name);
        if (!factory) {
            console.warn(`AnimalLogic "${name}" not found, falling back to "wolf"`);
            return new WolfAttackLogic();
        }
        return factory();
    }
}
