import { DecorationFactory } from './factories/DecorationFactory';

export class DecorationRegistry {
    private static factories = new Map<string, DecorationFactory>();

    static register(name: string, factory: DecorationFactory) {
        this.factories.set(name, factory);
    }

    static getFactory(name: string): DecorationFactory {
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`Factory ${name} not registered`);
        }
        return factory;
    }

    static async loadAll(): Promise<void> {
        if (false) {
            await Promise.all(Array.from(this.factories.values()).map(f => f.load()));
        } else {
            await this.factories.get('boat').load();
        }
    }
}
