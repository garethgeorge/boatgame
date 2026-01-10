import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class RockDecorator extends BaseDecorator {
    async decorate(context: DecorationContext): Promise<void> {
        const count = 1000;

        for (let i = 0; i < count; i++) {
            const position = this.generateRandomPosition(context);
            if (!this.isValidDecorationPosition(context, position)) continue;

            const biomeType = context.riverSystem.biomeManager.getBiomeType(position.worldZ);

            let threshold = 1.0;
            if (biomeType === 'desert') threshold = 0.96;
            else if (biomeType === 'forest') threshold = 0.96;
            else if (biomeType === 'ice') threshold = 0.90;
            else if (biomeType === 'swamp') threshold = 0.95;
            else if (biomeType === 'jurassic') threshold = 0.96;

            if (Math.random() > threshold) {
                const rockInstances = Decorations.getRockInstance(biomeType, Math.random());
                context.decoHelper.addInstancedDecoration(context, rockInstances, position);
            }
        }
    }
}
