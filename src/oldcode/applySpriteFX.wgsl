struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) texCoords: vec2f
}

@vertex
fn vertexMain(
    @location(0) pos: vec2f,  // xy
    @location(1) texCoords: vec2f, // uv
) -> VertexOut
{

    var output : VertexOut;

    output.position = vec4f(pos, 0.0, 1.0);
    output.texCoords = texCoords;

    return output;
}

// this is our sprite texture
@group(0) @binding(0)
var texSampler0: sampler;

@group(0) @binding(1)
var tex0: texture_2d<f32>;

//our texture effect texture
@group(1) @binding(0)
var texSampler1: sampler;

@group(1) @binding(1)
var tex1: texture_2d<f32>;



@fragment
fn fragmentMain(fragData: VertexOut) -> @location(0) vec4f
{
    // Sample colors from both textures
    let colorFromSprite = textureSample(tex0, texSampler0, fragData.texCoords);
    let colorFromEffect = textureSample(tex1, texSampler1, fragData.texCoords);

    // Calculate the alpha value from the sprite color
    let spriteAlpha = colorFromSprite.a;

    // If the sprite alpha is greater than zero, blend the colors; otherwise, use the sprite color
    var combinedColor: vec4f;
    if (spriteAlpha > 0.0) {
        combinedColor = mix(colorFromSprite, colorFromEffect, 0.7);
    } else {
        combinedColor = colorFromSprite;
    }

    return combinedColor;
}
