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

// this is our scene texture
@group(0) @binding(0)
var texSampler0: sampler;

@group(0) @binding(1)
var tex0: texture_2d<f32>;

//brightness blur texture
@group(1) @binding(0)
var texSampler1: sampler;

@group(1) @binding(1)
var tex1: texture_2d<f32>;



@fragment
fn fragmentMain(fragData: VertexOut ) -> @location(0) vec4f
{
    var screenTexture = textureSample(tex0, texSampler0, fragData.texCoords).rgb;
    //we combine the two textures for the bloom effect
    var brightnessblurTexture = textureSample(tex1, texSampler1, fragData.texCoords).rgb;
    //we dampen the color by multiplying the screen texture by the inverse of the brightnessblurTexture
    screenTexture *= (vec3f(1.0) - clamp(brightnessblurTexture, vec3f(0.0), vec3f(1.0)));


    return vec4f(screenTexture+brightnessblurTexture, 1.0);
}