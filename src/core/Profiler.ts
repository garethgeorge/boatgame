// @ts-ignore
import Stats from 'stats.js';

export class Profiler {
  // time based metrics
  private static metrics: Map<string, { min: number, max: number, avg: number, current: number, samples: number, sum: number }> = new Map();

  // value based metrics
  private static info: Map<string, { min: number, max: number, avg: number, current: number, samples: number, sum: number }> = new Map();

  private static startTimes: Map<string, { start: number, duration: number }> = new Map();

  private static overlay: HTMLElement | null = null;
  private static frameCount: number = 0;
  private static lastUpdate: number = 0;
  private static lastReset: number = 0;

  // stats.js
  private static stats: any = null;

  private static initOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '10px';
    this.overlay.style.right = '10px';
    this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.overlay.style.color = '#0f0';
    this.overlay.style.fontFamily = 'monospace';
    this.overlay.style.fontSize = '12px';
    this.overlay.style.padding = '10px';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.zIndex = '1000';
    document.body.appendChild(this.overlay);
    this.overlay.style.display = 'none'; // Hidden by default

    // Initialize stats.js
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '0px';
    this.stats.dom.style.left = '0px';
    this.stats.dom.style.display = 'none'; // Hidden by default

    document.body.appendChild(this.stats.dom);
  }

  static setVisibility(visible: boolean) {
    this.initOverlay();
    if (this.overlay) {
      this.overlay.style.display = visible ? 'block' : 'none';
    }
    if (this.stats) {
      this.stats.dom.style.display = visible ? 'block' : 'none';
    }
  }

  static addInfo(label: string, value: number) {
    if (!this.info.has(label)) {
      this.info.set(label, { min: value, max: value, avg: value, current: value, samples: 1, sum: value });
    }

    const metric = this.info.get(label)!;
    metric.current = value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.sum += value;
    metric.samples++;
    metric.avg = metric.sum / metric.samples;
  }

  static beginFrame() {
    if (this.stats)
      this.stats.begin();
  }

  static endFrame() {
    if (this.stats)
      this.stats.end();
    this.update();
  }

  static start(label: string) {
    this.startTimes.set(label, { start: performance.now(), duration: 0 });
  }

  static pause(label: string) {
    const entry = this.startTimes.get(label);
    if (entry === undefined) return;

    entry.duration += performance.now() - entry.start;
  }

  static resume(label: string) {
    const entry = this.startTimes.get(label);
    if (entry === undefined) return;

    entry.start = performance.now();
  }

  static end(label: string) {
    const entry = this.startTimes.get(label);
    if (entry === undefined) return;

    entry.duration += performance.now() - entry.start;

    if (!this.metrics.has(label)) {
      this.metrics.set(label, { min: Infinity, max: -Infinity, avg: 0, current: 0, samples: 0, sum: 0 });
    }

    const metric = this.metrics.get(label)!;
    if (metric) {
      metric.current = entry.duration;
      metric.min = Math.min(metric.min, entry.duration);
      metric.max = Math.max(metric.max, entry.duration);
      metric.sum += entry.duration;
      metric.samples++;
      metric.avg = metric.sum / metric.samples;
    }
  }

  private static update() {
    this.initOverlay();

    this.frameCount++;
    const now = performance.now();

    // Update display every 500ms
    if (now - this.lastUpdate > 500) {
      this.updateDisplay();
      this.lastUpdate = now;

      if (now - this.lastReset > 5000) {
        for (const metric of this.metrics.values()) {
          metric.avg = metric.current;
          metric.sum = metric.current;
          metric.samples = 1;
        }
        this.lastReset = now;
      }
    }
  }

  private static updateDisplay() {
    if (!this.overlay) return;
    let html = '<strong>Profiler</strong><br>';
    for (const [label, metric] of this.metrics) {
      html += `${label}: ${metric.avg.toFixed(2)}ms (Max: ${metric.max === -Infinity ? 0 : metric.max.toFixed(2)})<br>`;
    }
    html += '<br>';
    for (const [label, metric] of this.info) {
      html += `${label}: ${metric.current} (Max: ${metric.max === -Infinity ? 0 : metric.max})<br>`;
    }
    this.overlay.innerHTML = html;
  }
}
