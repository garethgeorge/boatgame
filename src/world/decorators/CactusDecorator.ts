import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class CactusDecorator extends BaseDecorator {
    async decorate(context: DecorationContext): Promise<void> {
        const count = 1000;

        for (let i = 0; i < count; i++) {
            const position = this.generateRandomPosition(context);
            if (!this.isValidDecorationPosition(context, position)) continue;

            const biomeType = context.riverSystem.biomeManager.getBiomeType(position.worldZ);

            if (Math.random() > 0.8) {
                const cactus = Decorations.getCactus();
                context.decoHelper.positionAndCollectGeometry(cactus, position, context);
            }
        }
    }
}
