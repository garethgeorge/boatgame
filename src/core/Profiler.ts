export class Profiler {
  private static metrics: Map<string, { min: number, max: number, avg: number, current: number, samples: number, sum: number }> = new Map();
  private static startTimes: Map<string, number> = new Map();
  private static overlay: HTMLElement | null = null;
  private static frameCount: number = 0;
  private static lastUpdate: number = 0;

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
  }

  static setVisibility(visible: boolean) {
    this.initOverlay();
    if (this.overlay) {
      this.overlay.style.display = visible ? 'block' : 'none';
    }
  }

  static start(label: string) {
    this.startTimes.set(label, performance.now());
  }

  static end(label: string) {
    const startTime = this.startTimes.get(label);
    if (startTime === undefined) return;

    const duration = performance.now() - startTime;

    if (!this.metrics.has(label)) {
      this.metrics.set(label, { min: Infinity, max: -Infinity, avg: 0, current: 0, samples: 0, sum: 0 });
    }

    const metric = this.metrics.get(label)!;
    metric.current = duration;
    metric.min = Math.min(metric.min, duration);
    metric.max = Math.max(metric.max, duration);
    metric.sum += duration;
    metric.samples++;
  }

  static update() {
    this.initOverlay();
    this.frameCount++;
    const now = performance.now();

    // Update display every 500ms
    if (now - this.lastUpdate > 500) {
      this.updateDisplay();
      this.lastUpdate = now;

      // Reset stats periodically? Or keep running avg?
      // Let's reset min/max every update to show recent spikes
      for (const metric of this.metrics.values()) {
        metric.avg = metric.sum / metric.samples;
        metric.sum = 0;
        metric.samples = 0;
        metric.min = Infinity;
        metric.max = -Infinity;
      }
    }
  }

  private static updateDisplay() {
    if (!this.overlay) return;
    let html = '<strong>Profiler</strong><br>';
    for (const [label, metric] of this.metrics) {
      html += `${label}: ${metric.avg.toFixed(2)}ms (Max: ${metric.max === -Infinity ? 0 : metric.max.toFixed(2)})<br>`;
    }
    this.overlay.innerHTML = html;
  }
}
