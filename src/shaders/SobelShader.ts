export const SobelShader = {
  name: "sobel",
  fragmentSource: `
    precision highp float;

    uniform sampler2D textureSampler;
    uniform vec2 resolution;

    varying vec2 vUV;

    void main(void) {
        vec2 texel = vec2(1.0 / resolution.x, 1.0 / resolution.y);

        // Kernel (Sobel)
        // Gx
        // -1  0  1
        // -2  0  2
        // -1  0  1
        
        // Gy
        // -1 -2 -1
        //  0  0  0
        //  1  2  1

        float t00 = dot(texture2D(textureSampler, vUV + texel * vec2(-1, -1)).rgb, vec3(0.299, 0.587, 0.114));
        float t10 = dot(texture2D(textureSampler, vUV + texel * vec2( 0, -1)).rgb, vec3(0.299, 0.587, 0.114));
        float t20 = dot(texture2D(textureSampler, vUV + texel * vec2( 1, -1)).rgb, vec3(0.299, 0.587, 0.114));
        
        float t01 = dot(texture2D(textureSampler, vUV + texel * vec2(-1,  0)).rgb, vec3(0.299, 0.587, 0.114));
        float t21 = dot(texture2D(textureSampler, vUV + texel * vec2( 1,  0)).rgb, vec3(0.299, 0.587, 0.114));
        
        float t02 = dot(texture2D(textureSampler, vUV + texel * vec2(-1,  1)).rgb, vec3(0.299, 0.587, 0.114));
        float t12 = dot(texture2D(textureSampler, vUV + texel * vec2( 0,  1)).rgb, vec3(0.299, 0.587, 0.114));
        float t22 = dot(texture2D(textureSampler, vUV + texel * vec2( 1,  1)).rgb, vec3(0.299, 0.587, 0.114));
        
        float gx = t00 * -1.0 + t20 * 1.0 + t01 * -2.0 + t21 * 2.0 + t02 * -1.0 + t22 * 1.0;
        float gy = t00 * -1.0 + t10 * -2.0 + t20 * -1.0 + t02 * 1.0 + t12 * 2.0 + t22 * 1.0;
        
        float dist = sqrt(gx * gx + gy * gy);
        
        vec4 baseColor = texture2D(textureSampler, vUV);
        
        // Threshold for outline
        // float alpha = step(0.1, dist);
         float alpha = smoothstep(0.4, 0.8, dist);
         
        // Darken edges subtly
        gl_FragColor = vec4(mix(baseColor.rgb, baseColor.rgb * 0.5, alpha), 1.0);
    }`
};
