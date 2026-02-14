import { Boat } from '../Boat';
import { AnyAnimal } from './AnimalBehavior';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPhase, AnimalLogicScript, AnimalLogicScriptFn } from './logic/AnimalLogic';
import { AnimalLogicConfig } from './logic/AnimalLogicConfigs';
import { AnimalLogicRegistry } from './logic/AnimalLogicRegistry';

interface ScriptStackEntry {
    script: AnimalLogicScriptFn;
    step: number;
}

export class AnimalScriptPlayer {
    private entity: AnyAnimal;
    private scriptStack: ScriptStackEntry[] = [];
    private nextLogicConfig: AnimalLogicConfig | null = null;
    private logic: AnimalLogic | null = null;
    private logicTimeout: number | undefined = undefined;
    private logicPhase: AnimalLogicPhase = AnimalLogicPhase.NONE;

    constructor(entity: AnyAnimal, script: AnimalLogicScript) {
        this.entity = entity;
        this.nextLogicConfig = this.beginScript(script, '');
    }

    public getLogic(): AnimalLogic | null {
        return this.logic;
    }

    public getPhase(): AnimalLogicPhase {
        return this.logicPhase;
    }

    private beginScript(script: AnimalLogicScript, lastResult: string): AnimalLogicConfig | null {
        if (!script) return null;

        if (typeof script === 'function') {
            this.scriptStack.push({ script, step: 0 });
            return this.resolveNextLogic('');
        } else {
            return script as AnimalLogicConfig;
        }
    }

    private resolveNextLogic(lastResult: string): AnimalLogicConfig | null {
        while (this.scriptStack.length > 0) {
            const entry = this.scriptStack[this.scriptStack.length - 1];
            const nextThing = entry.script(entry.step, lastResult);

            if (!nextThing) {
                this.scriptStack.pop();
                continue;
            }

            entry.step++;

            if (typeof nextThing === 'function') {
                this.scriptStack.push({ script: nextThing, step: 0 });
                continue;
            } else {
                return nextThing as AnimalLogicConfig;
            }
        }
        return null;
    }

    public update(context: AnimalLogicContext) {
        if (!this.logic && !this.nextLogicConfig) return;

        // Create and activate next logic if needed
        if (this.nextLogicConfig) {
            this.activateLogic(context, this.nextLogicConfig);
            this.nextLogicConfig = null;
        }

        if (!this.logic) return;

        // Update current logic
        let result = this.logic.update(context);

        // Check timeout
        if (this.logicTimeout !== undefined) {
            this.logicTimeout -= context.dt;
            if (this.logicTimeout <= 0.0) {
                result.result = 'TIMEOUT';
                result.finish = false;
            }
        }

        // Handle immediate chaining
        while (result.result && (result.finish === undefined || !result.finish)) {
            const nextConfig = this.resolveNextLogic(result.result);
            this.activateLogic(context, nextConfig);
            if (this.logic) {
                result = this.logic.update(context);
            } else {
                this.dispatchFinishedEvent();
                return result;
            }
        }

        // Events relative to current (possibly new) logic
        if (this.logic) {
            this.dispatchEvents(this.logic, context);
        }

        // Handle deferred chaining
        if (result.result && (result.finish !== undefined && result.finish)) {
            this.nextLogicConfig = this.resolveNextLogic(result.result);
            this.logic = null;
            if (!this.nextLogicConfig) {
                this.dispatchFinishedEvent();
            }
        }

        return result;
    }

    private activateLogic(context: AnimalLogicContext, config: AnimalLogicConfig) {
        if (!config) {
            this.logic = null;
            return;
        }

        this.logic = AnimalLogicRegistry.create(config);
        if (!this.logic) return;

        this.logic.activate(context);
        this.logicTimeout = config.timeout;
    }

    private dispatchEvents(logic: AnimalLogic, context: AnimalLogicContext) {
        const logicPhase = logic.getPhase();
        if (this.logicPhase !== logicPhase) {
            this.entity.handleBehaviorEvent?.({
                type: 'LOGIC_STARTING',
                logic: logic,
                logicPhase: logicPhase
            });
            this.logicPhase = logicPhase;
        }
        this.entity.handleBehaviorEvent?.({
            type: 'LOGIC_TICK',
            dt: context.dt,
            logic: logic,
            logicPhase: logicPhase
        });
    }

    private dispatchFinishedEvent() {
        this.entity.handleBehaviorEvent?.({
            type: 'LOGIC_FINISHED'
        });
        this.logicPhase = AnimalLogicPhase.NONE;
    }
}
