import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations } from '../Decorations';

export class TreeDecorator extends BaseDecorator {
    async decorate(context: DecorationContext): Promise<void> {
        const count = 1000;

        for (let i = 0; i < count; i++) {
            const position = this.generateRandomPosition(context);
            if (!this.isValidDecorationPosition(context, position)) continue;

            const biomeType = context.riverSystem.biomeManager.getBiomeType(position.worldZ);

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
            } else if (biomeType === 'jurassic') {
                if (Math.random() > 0.8) {
                    const tree = Decorations.getTree(Math.random(), false, false);
                    this.positionAndCollectGeometry(tree, position, context);
                }
            }
        }
    }
}
