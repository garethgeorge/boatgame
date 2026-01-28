import { AnimalLogic } from './AnimalLogic';
import { AnimalLogicConfig } from './AnimalLogicConfigs';
import { WolfAttackLogic } from './WolfAttackLogic';
import { AmbushAttackLogic } from './AmbushAttackLogic';
import { SwimAwayLogic } from './SwimAwayLogic';
import { ShoreLandingFlightLogic } from './ShoreLandingFlightLogic';
import { EnteringWaterLogic } from './EnteringWaterLogic';
import { WaitForBoatLogic } from './WaitForBoatLogic';
import { ShoreWalkLogic } from './ShoreWalkLogic';
import { DelayLogic } from './DelayLogic';
import { WaterLandingFlightLogic } from './WaterLandingFlightLogic';
import { WanderingFlightLogic } from './WanderingFlightLogic';
import { BuzzBoatFlightLogic } from './BuzzBoatFlightLogic';
import { FlyDirectToShoreLogic } from './FlyDirectToShoreLogic';
import { FlyOppositeBoatLogic } from './FlyOppositeBoatLogic';
import { SwimBackInRangeLogic } from './SwimBackInRangeLogic';

export class AnimalLogicRegistry {
    private static factories: Map<string, (params?: any) => AnimalLogic> = new Map();

    static {
        this.register('AmbushAttack', () => new AmbushAttackLogic());
        this.register('BuzzBoatFlight', (params) => new BuzzBoatFlightLogic(params));
        this.register('SwimAway', (params) => new SwimAwayLogic(params));
        this.register('Delay', (params) => new DelayLogic(params));
        this.register('EnteringWater', (params) => new EnteringWaterLogic(params));
        this.register('FlyDirectToShore', (params) => new FlyDirectToShoreLogic(params));
        this.register('FlyOppositeBoat', (params) => new FlyOppositeBoatLogic(params));
        this.register('ShoreLandingFlight', (params) => new ShoreLandingFlightLogic(params));
        this.register('ShoreWalk', (params) => new ShoreWalkLogic(params));
        this.register('WaitForBoat', (params) => new WaitForBoatLogic(params));
        this.register('WanderingFlight', (params) => new WanderingFlightLogic(params));
        this.register('WaterLandingFlight', (params) => new WaterLandingFlightLogic(params));
        this.register('SwimBackInRange', (params) => new SwimBackInRangeLogic(params));
        this.register('WolfAttack', () => new WolfAttackLogic());
    }

    public static register<T extends AnimalLogicConfig['name']>(
        name: T,
        factory: (params: Extract<AnimalLogicConfig, { name: T }>['params']) => AnimalLogic
    ) {
        this.factories.set(name, factory);
    }

    public static create(config: AnimalLogicConfig): AnimalLogic {
        const factory = this.factories.get(config.name);
        if (!factory) {
            console.warn(`AnimalLogic "${config.name}" not found, falling back to "WolfAttack"`);
            return new WolfAttackLogic();
        }
        return factory(config.params as any); // Cast here is safe due to register() being typed
    }
}
