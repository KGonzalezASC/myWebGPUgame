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

/// This function generates a value that oscillates between -1 and 1,
//influenced by the x and y components of the input vector `uv` and the current time `t.time`.
fn stripe(uv: vec2<f32>) -> f32 {
    return cos(uv.x * 20.0 - (t.time*-10)+uv.y*-40); //i*10 scaled time
}

/// This function generates a value that oscillates between -1 and 1,
//its called glass because it looks like a glass effect?
fn glass(uv: vec2<f32>) -> f32 {
    return cos(dot(uv.xy, vec2(12.41234,2442.123)) * cos(uv.y));
}




@fragment
fn fragmentMain(@location(0) fragCoord: vec2<f32>) -> @location(0) vec4<f32> {
    var uv = fragCoord; //the fragCoord is already in uv coordinates
    uv.x *= 2.0; // Adjust the width of the stripes
    var g: f32 = stripe(uv); // Calculate the stripe value
    // Use the stripe value to calculate an offset for the texture sampling
    var offset = vec2<f32>(g * 0.0015 - 0.022, 0);
    // Scale and translate fragCoord to fit within the stripe pattern bounds
    var minUV = vec2<f32>(.287, 0);
    var maxUV = vec2<f32>(.75, .875);
    var curvatureFactor: f32 = sin(fragCoord.x*10)/30 * .95;
    //var timeFactor = tan(t.time * 0.5) * 0.015 / (1.0 + abs(fragCoord.x) * 15.0); //using non-linear scaling to obscure the spin
    var scaledCoord = (fragCoord - minUV) / (maxUV - minUV) + curvatureFactor;// + vec2<f32>(timeFactor, 0.0);
    // Sample the texture using the scaled and offset coordinates
    var textureSample = textureSample(tex, texSampler, scaledCoord + offset );
    // Use the sampled texture color as the base color for the stripe pattern
    var baseColor = textureSample.rgb;
    // Apply the stripe pattern modulation to the base color
    var col: vec3<f32> = mix(baseColor, vec3<f32>(0.0, 0.0, 0.0), smoothstep(0.4, 0.6, g));
    // Apply glass effect (those wild lines) to the color
    col /= (pow(glass(vec2(uv.x * 20.0, uv.y)), 2.0)) + 0.5;
    // Adjust horizontal and vertical edges to move the pattern around
    let horizontalEdge = 1.0; // Adjust this to move the pattern left/right
    col *= smoothstep(0.5, 0.0, abs(uv.x - horizontalEdge));
    let timeOscillation = abs(sin(t.time)) * 0.1 + 0.04; // Oscillation amplitude
    let verticalEdge = 0.35 + timeOscillation;
    col *= smoothstep(0.33 + timeOscillation, 0.3 - timeOscillation, abs(uv.y - verticalEdge));
    return vec4<f32>(col, 1.0);
}





//@fragment just the pattern
//fn fragmentMain(@location(0) fragCoord: vec2<f32>) -> @location(0) vec4<f32> {
//    var uv = fragCoord;
//    uv.x *= 2.0;
//    var g:f32 = stripe(uv);
//    var col = vec3<f32>(smoothstep(0.0, 0.5, 0.2), g, 0.5);
//    col /= (pow(glass(vec2(uv.x*20,uv.y)),2.0))+.5;
//    let horizontalEdge = 1.0; // Adjust this to move the pattern left/right
//    col *= smoothstep(0.5, 0.0, abs(uv.x - horizontalEdge)); // uv.x affects horizontal position
//    let timeOscillation = abs(sin(t.time)) * 0.1 +.04; // Oscillation amplitude
//    let verticalEdge = .35+ timeOscillation;
//    col *= smoothstep(0.33+timeOscillation, 0.3-timeOscillation, abs(uv.y - verticalEdge));
//    //if ((uv.y > 0.80 && uv.y < 0.94) || (uv.y < 0.20 && uv.y > 0.06)) {
//    //col = vec3<f32>(smoothstep(0.13, 0.0, abs(uv.x - 0.5)));
//    //}
//    //if ((uv.y > 0.77 && uv.y < 0.87) || (uv.y < 0.23 && uv.y > 0.13)) {
//    //    col = vec3<f32>(smoothstep(0.15, 0.0, abs(uv.x - 0.5)));
//    //}
////    textureSample = mix(textureSample, vec4<f32>(col, 1.0), .3);
////    //return vec4<f32>(col, 1.0);
///}



