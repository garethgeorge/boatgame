import { AnimalLogic, AnimalLogicConfig } from './AnimalLogic';
import { WolfAttackLogic } from './WolfAttackLogic';
import { AmbushAttackLogic } from './AmbushAttackLogic';
import { DefaultSwimAwayLogic } from './DefaultSwimAwayLogic';
import { ShoreLandingFlightLogic } from './ShoreLandingFlightLogic';
import { EnteringWaterLogic } from './EnteringWaterLogic';
import { WaitForBoatLogic } from './WaitForBoatLogic';
import { ShoreWalkLogic } from './ShoreWalkLogic';
import { DelayLogic } from './DelayLogic';
import { WaterLandingFlightLogic } from './WaterLandingFlightLogic';
import { WanderingFlightLogic } from './WanderingFlightLogic';
import { BuzzBoatFlightLogic } from './BuzzBoatFlightLogic';
import { FlyDirectToShoreLogic } from './FlyDirectToShoreLogic';

export class AnimalLogicRegistry {
    private static factories: Map<string, (params?: any) => AnimalLogic> = new Map();

    static {
        this.register(AmbushAttackLogic.NAME, () => new AmbushAttackLogic());
        this.register(BuzzBoatFlightLogic.NAME, (params) => new BuzzBoatFlightLogic(params as any));
        this.register(DefaultSwimAwayLogic.NAME, () => new DefaultSwimAwayLogic());
        this.register(DelayLogic.NAME, (params) => new DelayLogic(params as any));
        this.register(EnteringWaterLogic.NAME, (params) => new EnteringWaterLogic(params as any));
        this.register(FlyDirectToShoreLogic.NAME, (params) => new FlyDirectToShoreLogic(params as any));
        this.register(ShoreLandingFlightLogic.NAME, (params) => new ShoreLandingFlightLogic(params as any));
        this.register(ShoreWalkLogic.NAME, (params) => new ShoreWalkLogic(params as any));
        this.register(WaitForBoatLogic.NAME, (params) => new WaitForBoatLogic(params as any));
        this.register(WanderingFlightLogic.NAME, (params) => new WanderingFlightLogic(params as any));
        this.register(WaterLandingFlightLogic.NAME, (params) => new WaterLandingFlightLogic(params as any));
        this.register(WolfAttackLogic.NAME, () => new WolfAttackLogic());
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
