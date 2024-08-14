// Structure that defines the output of the vertex shader.
struct VertexOut {
    // The final position of our vertex in homogeneous coordinates.
    //builtin is a keyword for the compiler to know that this is a special variable
    @builtin(position) position : vec4f,
    //@location is used to specify the index of a user-defined input or output variable in shaders.
    //It allows you to map shader
    //inputs and outputs to specific locations so that the GPU can correctly
    //pass it to fragment shader from vertex shader
    @location(0) texCoord : vec2f,
    // The color attribute for the vertex, passed to the fragment shader.
    @location(1) color : vec4f,
}

//uniform group //affects all vertices in the same way of the modal data
//is just stores a transformation matrix
//transforming object from model space to world space
//since we are working in 2d space, we are using 2d projection matrix and
//having another uniform would seem redundant
@group(0) @binding(0)
var<uniform> projectionViewMatrix: mat4x4f;


@vertex
fn vertexMain(
    //simple shader in 2d space
    @location(0) position: vec2f, // The position of the vertex.
    @location(1) texCoord: vec2f, // The texture coordinates of the vertex.
    @location(2) color: vec3f,   // The color of the vertex.
) -> VertexOut {
    // Initialize the output structure.
    var output : VertexOut;
    output.position = projectionViewMatrix * vec4f(position.x, position.y, 0.0, 1.0);
    output.color = vec4f(color, 1.0);
    output.texCoord = texCoord;
    return output;
}

// Main vertex shader function.
//@vertex
//fn vertexMain(
//  // The index of the current vertex being processed.
//  @builtin(vertex_index) vertexIndex : u32,
//) -> VertexOut {
//      // we are now passing the geometry from cpu to gpu through buffer instead of hardcoding it in shader
//      //    // An array of positions for a triangle's vertices.
//      //    // Each vertex is defined as a vec4f (4-component vector of floats).
//      //    let pos = array<vec4f, 3>(
//      //        vec4f(-0.5, -0.5, 0.0, 1.0), // Bottom-left vertex
//      //        vec4f(0.5, -0.5, 0.0, 1.0),  // Bottom-right vertex
//      //        vec4f(0.0, 0.5, 0.0, 1.0),   // Top vertex
//      //    );
//
//    // Initialize the output structure.
//    var output : VertexOut;
//    // Set the position of the current vertex based on the vertex index.
//    output.position = pos[vertexIndex];
//    // Set the color of the vertex. This example uses a constant color.
//    // This can be modified to use different colors per vertex if desired.
//    output.color = vec4f(1.0, 0.0, 0.0, 1.0); // Red color
//
//    return output;
//}


//group and binding are specifically used for texture sampling
//an object that says how texture will be sampled like scaling anti-aliasing etc
//(e.g., filtering modes, wrapping modes)
@group(1) @binding(0)
var textSampler: sampler;
//just our texture
@group(1) @binding(1)
var tex: texture_2d<f32>;


struct FragmentOut {
    @location(0) color : vec4f,
    //talk to second color attachment
    @location(1) brightness : vec4f,
};

const brightnessThreshold : f32 = 0.4;



@fragment
fn fragmentMain(fragData: VertexOut ) -> FragmentOut
{
    var out: FragmentOut;
    // Sample the texture using the texture coordinates passed from the vertex shader.
    var texColor = textureSample(tex, textSampler, fragData.texCoord) * fragData.color;
    out.color = texColor;
    //u can get brightness by dot product or by averaging the color values
    var l = dot(texColor.rgb, vec3f(0.299, 0.587, 0.114));

    if(l > brightnessThreshold)
    {
        out.brightness = texColor;
    }
    else
    {
        out.brightness = vec4f(0.0, 0.0, 0.0, texColor.a);
    }

    //multiplying allows us to blend the color of the texture with the color of the vertex
    // Return the interpolated color of the fragment.
    return out;
}
