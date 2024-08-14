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

struct Time {
    time: f32,
};

@group(0) @binding(0)
var texSampler: sampler;

@group(0) @binding(1)
var tex: texture_2d<f32>;

@group(0) @binding(2)
var<uniform> t: Time;


@fragment
fn fragmentMain(@location(0) fragCoord: vec2<f32>) -> @location(0) vec4<f32> {
    //wobbleFX
    var uv = fragCoord; //the fragCoord is already in uv coordinates
    uv.x = fract(uv.x + sin(uv.y  + t.time*10) * .01); //makes a wobble effect
    // Sample the texture using the modified uv coordinates
    var textureSample = textureSample(tex, texSampler, uv);
    return textureSample;
}