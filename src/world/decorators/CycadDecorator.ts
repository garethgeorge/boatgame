import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class CycadDecorator extends BaseDecorator {
    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const count = 1000;

        for (let i = 0; i < count; i++) {
            const position = this.generateRandomPosition(context);
            if (!this.isValidDecorationPosition(context, position)) continue;

            const biomeType = context.riverSystem.biomeManager.getBiomeType(position.worldZ);

            if (Math.random() > 0.8) {
                const cycadInstances = Decorations.getCycadInstance();
                context.decoHelper.addInstancedDecoration(context, cycadInstances, position);
            }
        }
    }
}
