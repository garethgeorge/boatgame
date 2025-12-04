import { ShoreAnimalDecorator } from './ShoreAnimalDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class AlligatorDecorator extends ShoreAnimalDecorator {
    async decorate(context: DecorationContext): Promise<void> {
        await this.decorateShoreAnimal(
            context,
            'desert',
            0.3,
            () => Decorations.getAlligator()
        );
    }
}
