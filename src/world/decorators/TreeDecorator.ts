import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class TreeDecorator extends BaseDecorator {
    async decorate(context: DecorationContext): Promise<void> {
        return this.decorateInRange(context, context.zOffset, context.zOffset + 62.5); // CHUNK_SIZE
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
                    const tree = Decorations.getTree(Math.random(), false, false);
                    this.positionAndCollectGeometry(tree, position, context);
                }
            } else if (biomeType === 'ice') {
                if (Math.random() > 0.8) {
                    const isLeafless = Math.random() > 0.5;
                    const tree = Decorations.getTree(Math.random(), !isLeafless, isLeafless);
                    this.positionAndCollectGeometry(tree, position, context);
                }
            }
        }
    }
}
