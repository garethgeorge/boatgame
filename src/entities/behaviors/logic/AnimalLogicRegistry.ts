import { AnimalLogic, AnimalLogicConfig } from './AnimalLogic';
import { WolfAttackLogic } from './WolfAttackLogic';
import { AmbushAttackLogic } from './AmbushAttackLogic';
import { DefaultSwimAwayLogic } from './DefaultSwimAwayLogic';
import { DefaultFlightLogic } from './DefaultFlightLogic';

export class AnimalLogicRegistry {
    private static factories: Map<string, () => AnimalLogic> = new Map();

    static {
        this.register('wolf', () => new WolfAttackLogic());
        this.register('ambush', () => new AmbushAttackLogic());
        this.register('swimaway', () => new DefaultSwimAwayLogic());
        this.register('flight', () => new DefaultFlightLogic());
    }

    public static register(name: string, factory: () => AnimalLogic) {
        this.factories.set(name, factory);
    }

    public static create(config: AnimalLogicConfig): AnimalLogic {
        const factory = this.factories.get(config.name);
        if (!factory) {
            console.warn(`AnimalLogic "${config.name}" not found, falling back to "wolf"`);
            return new WolfAttackLogic();
        }
        return factory();
    }
}
