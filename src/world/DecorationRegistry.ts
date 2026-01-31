import { DecorationFactory } from './factories/DecorationFactory';

export class DecorationRegistry {
    private static factories = new Map<string, DecorationFactory>();

    static register<T extends string>(name: T, factory: DecorationFactory) {
        this.factories.set(name, factory);
    }

    static getFactory<T extends string>(name: T): DecorationFactory {
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`Factory ${name} not registered`);
        }
        return factory;
    }

    static hasFactory<T extends string>(name: T): boolean {
        return this.factories.has(name);
    }

    static async load<T extends string>(name: T): Promise<void> {
        const factory = this.factories.get(name);
        if (factory) {
            await factory.load();
        }
    }

    static async loadAll<T extends string>(names?: T[]): Promise<void> {
        return this.loadFiltered((name) => !names || names.includes(name as T));
    }

    static async loadFiltered(filter: (name: string, factory: DecorationFactory) => boolean): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const [name, factory] of this.factories) {
            if (filter(name, factory)) {
                promises.push(factory.load());
            }
        }
        await Promise.all(promises);
    }
}
