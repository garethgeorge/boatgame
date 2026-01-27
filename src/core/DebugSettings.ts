export class DebugSettings {
    public static readonly isRelease: boolean = false;
    public static geometryVisible: boolean = false;
    public static profilerVisible: boolean = false;
    public static debugConsoleVisible: boolean = false;
    public static debugMenuVisible: boolean = false;

    public static leakCheckEnabled: boolean = false;
    public static leakCheckInterval: number = 10.0 * 1000.0; // milli-seconds
    public static nextLeakCheckTime: number = 0;
}
