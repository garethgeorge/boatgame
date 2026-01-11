import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class TreeDecorator extends BaseDecorator {
    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        return this.decorateInRange(context, zStart, zEnd);
    }

    async decorateInRange(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16); // Approx 1000 per 62.5m chunk

        const biomeType = context.riverSystem.biomeManager.getBiomeType((zStart + zEnd) / 2);

        for (let i = 0; i < count; i++) {
            const position = this.generateRandomPositionInRange(context, zStart, zEnd);
            if (!this.isValidDecorationPosition(context, position)) continue;

            if (biomeType === 'forest') {
                if (Math.random() > 0.8) {
                    const treeInstances = Decorations.getTreeInstance(Math.random(), 'round', false, false);
                    context.decoHelper.addInstancedDecoration(context, treeInstances, position);
                }
            } else if (biomeType === 'ice') {
                if (Math.random() > 0.8) {
                    const isLeafless = Math.random() > 0.5;
                    const treeInstances = Decorations.getTreeInstance(Math.random(), 'round', !isLeafless, isLeafless);
                    context.decoHelper.addInstancedDecoration(context, treeInstances, position);
                }
            }
        }
    }
}
