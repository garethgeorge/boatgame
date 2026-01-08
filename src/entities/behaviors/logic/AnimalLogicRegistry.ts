import { AnimalLogic, AnimalLogicConfig } from './AnimalLogic';
import { WolfAttackLogic } from './WolfAttackLogic';
import { AmbushAttackLogic } from './AmbushAttackLogic';
import { DefaultSwimAwayLogic } from './DefaultSwimAwayLogic';
import { DefaultFlightLogic } from './DefaultFlightLogic';
import { EnteringWaterLogic } from './EnteringWaterLogic';

export class AnimalLogicRegistry {
    private static factories: Map<string, (params?: any) => AnimalLogic> = new Map();

    static {
        this.register(WolfAttackLogic.NAME, () => new WolfAttackLogic());
        this.register(AmbushAttackLogic.NAME, () => new AmbushAttackLogic());
        this.register(DefaultSwimAwayLogic.NAME, () => new DefaultSwimAwayLogic());
        this.register(DefaultFlightLogic.NAME, () => new DefaultFlightLogic());
        this.register(EnteringWaterLogic.NAME, (params) => new EnteringWaterLogic(params as any));
    }

    public static register(name: string, factory: (params?: any) => AnimalLogic) {
        this.factories.set(name, factory);
    }

    public static create(config: AnimalLogicConfig): AnimalLogic {
        const factory = this.factories.get(config.name);
        if (!factory) {
            console.warn(`AnimalLogic "${config.name}" not found, falling back to "${WolfAttackLogic.NAME}"`);
            return new WolfAttackLogic();
        }
        return factory(config.params);
    }
}
