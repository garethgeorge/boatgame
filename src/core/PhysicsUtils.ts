import * as planck from 'planck'

export class PhysicsUtils {
    public static setCollisionMask(body: planck.Body, maskBits: number) {
        for (let b = body.getFixtureList(); b; b = b.getNext()) {
            b.setFilterData({
                categoryBits: b.getFilterCategoryBits(),
                maskBits: maskBits,
                groupIndex: b.getFilterGroupIndex()
            });
        }
    }

    public static setCollisionCategory(body: planck.Body, categoryBits: number) {
        for (let b = body.getFixtureList(); b; b = b.getNext()) {
            b.setFilterData({
                categoryBits: categoryBits,
                maskBits: b.getFilterMaskBits(),
                groupIndex: b.getFilterGroupIndex()
            });
        }
    }

    public static setCollisionGroup(body: planck.Body, groupIndex: number) {
        for (let b = body.getFixtureList(); b; b = b.getNext()) {
            b.setFilterData({
                categoryBits: b.getFilterCategoryBits(),
                maskBits: b.getFilterMaskBits(),
                groupIndex: groupIndex
            });
        }
    }

    public static updateCollisionMask(body: planck.Body, maskBits: number, enable: boolean) {
        for (let b = body.getFixtureList(); b; b = b.getNext()) {
            const currentMask = b.getFilterMaskBits();
            const newMask = enable ? (currentMask | maskBits) : (currentMask & ~maskBits);
            b.setFilterData({
                categoryBits: b.getFilterCategoryBits(),
                maskBits: newMask,
                groupIndex: b.getFilterGroupIndex()
            });
        }
    }
}
