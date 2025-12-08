import * as THREE from 'three';

export const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x4da6ff) },
    uFlowDirection: { value: new THREE.Vector2(0, 1) }, // Flow along Z
    uSunPosition: { value: new THREE.Vector3(50, 100, 50) },
    uBoatPosition: { value: new THREE.Vector3(0, 0, 0) },
    uBoatVelocity: { value: new THREE.Vector2(0, 0) },
    uBoatDirection: { value: new THREE.Vector2(0, -1) },
    uBoatHistory: { value: new Array(8).fill(new THREE.Vector3(0, 0, 0)) },
    uSwampFactor: { value: 0.0 },
    uSwampColor: { value: new THREE.Color(0x2f4f2f) }, // Dark Green
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec2 uFlowDirection;
    uniform vec3 uSunPosition;
    uniform vec3 uBoatPosition;
    uniform vec2 uBoatVelocity;
    uniform vec2 uBoatDirection;
    uniform vec3 uBoatHistory[8];
    uniform float uSwampFactor;
    uniform vec3 uSwampColor;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    vec2 rotate(vec2 v, float a) {
      float s = sin(a);
      float c = cos(a);
      mat2 m = mat2(c, -s, s, c);
      return m * v;
    }

    // Distance from point p to line segment ab
    float distToSegment(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h);
    }

    void main() {
      // Base UVs
      vec2 flowUV = vWorldPosition.xz * 0.05; 
      
      // Domain Warping for "Random Curvature"
      float warp = snoise(flowUV * 0.5 + uTime * 0.1);
      vec2 warpedUV = flowUV + vec2(warp * 0.2, 0.0); 
      
      // Flow Parameters
      float speed = 0.6; 
      float stretch = 0.15; 
      float scale = 10.0;
      
      // Primary Flow Layer
      vec2 uv1 = warpedUV;
      uv1.y += uTime * speed; 
      uv1.y *= stretch; 
      float noise1 = snoise(vec2(uv1.x * scale, uv1.y)); 
      
      // Secondary Flow Layer
      vec2 uv2 = warpedUV;
      uv2.y += uTime * speed * 1.2;
      uv2.y *= stretch;
      float noise2 = snoise(vec2(uv2.x * scale * 1.5 + 10.0, uv2.y * 1.5));
      
      // Combine
      float flowPattern = noise1 * 0.7 + noise2 * 0.3;
      
      // Threshold for "vector" lines
      float lineMix = smoothstep(0.4, 0.7, flowPattern);
      
      // Pulse
      float pulse = sin(uTime * 3.0 + vWorldPosition.x * 0.5) * 0.1 + 0.9;
      lineMix *= pulse;

      // --- Boat Wake Logic ---
      float wakeMix = 0.0;
      
      // History Trail (Persistent Wake)
      vec2 prevPos = uBoatPosition.xz;
      float minDist = 1000.0;
      float currentWidth = 0.0;
      float ageAtMinDist = 0.0;
      
      for (int i = 0; i < 8; i++) {
        vec2 histPos = uBoatHistory[i].xz;
        
        // Skip if history point is effectively zero (uninitialized)
        if (length(histPos) < 0.1) break;
        
        float d = distToSegment(vWorldPosition.xz, prevPos, histPos);
        
        // Trail width expands with age
        float age = float(i);
        float width = 1.0 + age * 2.0; 
        
        if (d < minDist) {
            minDist = d;
            currentWidth = width;
            ageAtMinDist = age;
        }
        
        prevPos = histPos;
      }
      
      // Simple Dithered Wake
      // Relaxed cutoff to allow for soft edges
      if (minDist < currentWidth + 4.0) {
          // Noise for dithering (Larger scale, softer)
          // Reduced scale for bigger ripples, removed directional stretch
          float noise = snoise(vWorldPosition.xz * 1.5 + uTime * 2.0);
          
          // Soft Edge Calculation
          // Fade from 1.0 (inside) to 0.0 (outside)
          // The transition happens around 'currentWidth'
          // We add noise to minDist to distort the shape
          float distWithNoise = minDist - noise * 1.5;
          float alpha = 1.0 - smoothstep(currentWidth - 2.0, currentWidth + 1.0, distWithNoise);
          
          // Intensity fade
          float fade = 1.0 - (ageAtMinDist / 8.0);
          fade = pow(fade, 2.0); // Faster age fade
          fade *= exp(-length(vWorldPosition.xz - uBoatPosition.xz) * 0.03); // Slower distance fade to show expansion
          
          wakeMix = alpha * fade * 0.8; 
      }
      
      // Clamp wake
      wakeMix = clamp(wakeMix, 0.0, 1.0);

    // --- Swamp Ripple Logic ---
    float rippleMix = 0.0;
    if (uSwampFactor > 0.01) {
        vec2 rippleUV = vWorldPosition.xz * 0.5; // Scale for ripples
        float rippleTime = uTime * 2.0;
        
        // Grid based ripples
        vec2 gv = fract(rippleUV) - 0.5;
        vec2 id = floor(rippleUV);
        
        float d = length(gv);
        
        // Random start time per cell
        float t = rippleTime + snoise(id) * 10.0;
        
        // Periodic ripples
        float p = fract(t); // 0 to 1
        
        // Ring: sin wave expanding
        // Only show if p is small (start of cycle)
        // But we want random frequency.
        
        // Better approach: Voronoi-ish or just simple noise rings
        // Let's use a simple interference pattern of multiple sine waves
        float r1 = sin(length(vWorldPosition.xz - vec2(10.0, 10.0)) * 2.0 - uTime * 4.0);
        float r2 = sin(length(vWorldPosition.xz - vec2(-20.0, 50.0)) * 3.0 - uTime * 3.0);
        // This is too static.
        
        // Let's go with the "Rain" effect using noise to trigger
        // Simplified: Just use high frequency noise that looks like disturbed water
        // plus some circular shapes.
        
        // Circular Ripple Function
        // We can't easily do many random expanding rings without a loop or complex noise.
        // Let's stick to a "boiling" / "active" stagnant water look using noise.
        // Or "Bug landing" = random small circles appearing.
        
        // Let's try a cellular noise approach for rings
        // For each cell, pick a random center and time.
        // If time matches, draw ring.
        
        vec2 cellUV = vWorldPosition.xz * 0.2; // 5 meter cells
        vec2 cellID = floor(cellUV);
        vec2 cellPos = fract(cellUV);
        
        float cellNoise = snoise(cellID); // Random value per cell
        float cellTime = uTime + cellNoise * 100.0;
        
        // Randomize center within cell
        vec2 center = vec2(0.5) + vec2(snoise(cellID + 1.0), snoise(cellID + 2.0)) * 0.3;
        
        float dist = length(cellPos - center);
        
        // Ripple lifecycle: 0 to 1
        float life = fract(cellTime * 0.5); // 2 seconds per ripple
        
        // Ring radius expands from 0 to 0.5
        float radius = life * 0.8;
        
        // Ring width
        float width = 0.05;
        
        // Ring mask
        float ring = smoothstep(width, 0.0, abs(dist - radius));
        
        // Fade out as it expands
        ring *= (1.0 - life);
        
        // Only show ripples in some cells (sparse bugs)
        if (cellNoise > 0.3) {
             rippleMix += ring;
        }
        
        // Add a second layer for density
        // ... (Skipping for performance/simplicity, one layer might be enough or we can just rely on noise)
    }

      // --- End Wake Logic ---
      
      // Toon Shading (Lighting)
      vec3 lightDir = normalize(uSunPosition);
      float diff = max(dot(vNormal, lightDir), 0.0);
      
      // 3-step Toon Ramp
      float lightIntensity;
      if (diff > 0.9) lightIntensity = 1.0;
      else if (diff > 0.5) lightIntensity = 0.8;
      else lightIntensity = 0.6;
      
      // Final Color
      vec3 baseColor = uColor * lightIntensity;
      vec3 swampColor = uSwampColor * lightIntensity;
      
      vec3 wakeColor = vec3(0.9, 0.9, 0.9); // Light Grey/White
      
      // Combine flow lines and wake
      // Flow lines are subtle, wake is dominant
      
      // Reduce flow line intensity in swamp (stagnant water)
      float flowIntensity = 1.0 - uSwampFactor * 0.8; // Reduce by 80% in swamp
      
      float totalMix = clamp(lineMix * 0.1 * flowIntensity + wakeMix, 0.0, 1.0);
      
      // Mix Base and Swamp
      vec3 waterColor = mix(baseColor, swampColor, uSwampFactor);
      
      // Add Ripples to Swamp (as white highlights)
      if (uSwampFactor > 0.0) {
          waterColor = mix(waterColor, vec3(0.8, 0.9, 0.8), rippleMix * uSwampFactor * 0.5);
      }
      
      vec3 finalColor = mix(waterColor, wakeColor, totalMix);
      
      gl_FragColor = vec4(finalColor, 0.8); // Transparency
    }
  `
};
