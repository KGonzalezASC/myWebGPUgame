struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) texCoords: vec2f,
}

@vertex
fn vertexMain(
    @location(0) pos: vec2f,  // xy
    @location(1) texCoords: vec2f, // uv
) -> VertexOut
{
    var output: VertexOut;
    output.position = vec4f(pos, 0.0, 1.0);
    output.texCoords = texCoords;
    return output;
}

@group(0) @binding(0)
var texSampler: sampler;

@group(0) @binding(1)
var tex: texture_2d<f32>;

@group(0) @binding(2)
var<uniform> isSpriteFX: i32; // Using i32 to represent boolean

@fragment
fn fragmentMain(fragData: VertexOut) -> @location(0) vec4f
{
    var screenTexture = textureSample(tex, texSampler, fragData.texCoords);
    //if false, apply grayscale effect to screen not sprite
    if (isSpriteFX == 0) {
        // Grayscale effect
        var average = (screenTexture.r + screenTexture.g + screenTexture.b) / 3.0;
        return vec4f(average, average, average,1);
    } else {
        // SpriteFX effect
        // Make the background transparent but keep the sprite itself grey
        var alphaThreshold = 0.1; // Threshold to decide if pixel should be transparent
        var average = (screenTexture.r + screenTexture.g + screenTexture.b) / 3.0;

        if (screenTexture.a < alphaThreshold) {
            // Make background transparent
            return vec4f(0.0, 0.0, 0.0, 0.0);
        } else {
            // Make sprite grey
            return vec4f(average, average, average, screenTexture.a);
        }
    }
}
