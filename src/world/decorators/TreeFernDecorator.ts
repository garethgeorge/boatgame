import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class TreeFernDecorator extends BaseDecorator {
    async decorate(context: DecorationContext): Promise<void> {
        const count = 500;

        for (let i = 0; i < count; i++) {
            const position = this.generateRandomPosition(context);
            if (!this.isValidDecorationPosition(context, position)) continue;

            const biomeType = context.riverSystem.biomeManager.getBiomeType(position.worldZ);
            if (biomeType !== 'jurassic') continue;

            // Mix with cycads, maybe slightly more rare?
            if (Math.random() > 0.8) {
                const fern = Decorations.getTreeFern();
                this.positionAndCollectGeometry(fern, position, context);
            }
        }
    }
}
