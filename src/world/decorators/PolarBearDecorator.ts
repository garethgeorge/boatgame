import { ShoreAnimalDecorator } from './ShoreAnimalDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class PolarBearDecorator extends ShoreAnimalDecorator {
    async decorate(context: DecorationContext): Promise<void> {
        await this.decorateShoreAnimal(
            context,
            'ice',
            0.3,
            () => Decorations.getPolarBear()
        );
    }
}
