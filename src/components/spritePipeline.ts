import {Texture} from "./simpleComponents/texture.ts";
import shaderSource from './shaders/applyScreenFX.wgsl?raw';


export class SpritePipeline{
    //use to be handled in a useState hook in the rendererProvider.tsx file
    //but now we are storing it in the class because
    //the pipeline is recreated every time a new sprite is created per frame
    public pipeline!: GPURenderPipeline;
    ///A bind group in graphics programming refers to a collection of resources,
    // such as textures, buffers, and samplers, that are used by shaders during rendering.
    // The concept of bind groups is designed to optimize the binding of resources to the GPU, making it more efficient to switch between different sets of resources.
    // This is especially important in real-time rendering applications like games or interactive graphics, where performance is critical.
    public textureBindGroup!: GPUBindGroup;
    //projectionview bind group which is used to store the projection view matrix to be used in the shader
    public projectionViewBindGroup!: GPUBindGroup;

    public static create(device: GPUDevice, texture: Texture, projectionViewMatrixBuffer: GPUBuffer): SpritePipeline
    {
        const pipeline = new SpritePipeline();
        pipeline.init(device, texture, projectionViewMatrixBuffer);
        return pipeline;
    }


    public init( device: GPUDevice, texture: Texture, projectionViewMatrixBuffer: GPUBuffer){
        // read the shader source from the file
        const shaderModule = device.createShaderModule({
            code: shaderSource,
        });
        // //specify the layout for the buffers: position, color, and texture
        // const positionBufferLayout: GPUVertexBufferLayout = {
        //     arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT, // 2 floats per vertex (x, y) * 4 bytes per float
        //     stepMode: 'vertex', // move to the next vertex after processing 1 vertex
        //     attributes: [
        //         {
        //             shaderLocation: 0, //should be consistent with location in shader
        //             offset: 0,
        //             format: 'float32x2', // 2 floats per vertex
        //         },
        //     ],
        // };
        //
        // const colorBufferLayout: GPUVertexBufferLayout = {
        //     arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
        //     stepMode: 'vertex',
        //     attributes: [
        //         {
        //             shaderLocation: 1,
        //             offset: 0,
        //             format: 'float32x3',
        //         },
        //     ],
        // };
        //
        // const textureBufferLayout: GPUVertexBufferLayout = {
        //     arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
        //     stepMode: 'vertex',
        //     attributes: [
        //         {
        //             shaderLocation: 2,
        //             offset: 0,
        //             format: 'float32x2',
        //         },
        //     ],
        // };
        const interleaveBufferLayout: GPUVertexBufferLayout = {
            //arraystride describe a single vertex
            arrayStride: 7 * Float32Array.BYTES_PER_ELEMENT,  // 7 floats per vertex (x, y, u, v, r, g, b) * 4 bytes per float
            stepMode: 'vertex',  // move to the next vertex after processing 1 vertex
            attributes: [
                { shaderLocation: 0, //should be consistent with location in shader
                    offset: 0,
                    format: 'float32x2' // 2 floats per vertex (x, y)
                },
                { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: 'float32x2' },
                { shaderLocation: 2, offset: 4 * Float32Array.BYTES_PER_ELEMENT, format: 'float32x3' },
            ],
        };

        //specify the vertex and fragment shaders using the shader module
        //also specify the buffers that will be used in the shaders (interleave buffer)
        const vertexState: GPUVertexState = {
            module: shaderModule,
            entryPoint: 'vertexMain',
            buffers: [interleaveBufferLayout],
        };

        const fragmentState: GPUFragmentState = {
            module: shaderModule,
            entryPoint: 'fragmentMain',
            //targets are the color attachments that will be rendered to
            //which correespond to the locations in the shader
            targets: [
                {
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    blend: {
                        //what should texture do when applied to the screen
                        //aka the target
                        //this means source texture * srcFactor + destination texture * dstFactor
                        //this produces a transparent effect allowing the background to show through
                        color: {
                            srcFactor: 'src-alpha', //do this to remove the outline of the sprite
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        //this produces a transparent effect allowing the background to show through
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'zero',
                            operation: 'add',
                        },
                    },
                },
                //this goes to the bloom effect location (1) in the render pass
                //we need to render two color attachments to the screen texture
                {
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'zero',
                            operation: 'add',
                        },
                    },
                },
            ],
        };

        const projectionViewBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                    },
                },
            ],
        });

        const textureBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                }
            ]
        });

        //this is the pipeline layout that specifies the order of bind groups
        //this means that the projection view bind group will be first and the texture bind group will be second
        //this is important because the shader group has indices that reference the bind group
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [projectionViewBindGroupLayout, textureBindGroupLayout],
        });

        //create a bind group using the texture and sampler
        this.textureBindGroup = device.createBindGroup({
            layout: textureBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: texture.sampler
                },
                {
                    binding: 1,
                    resource: texture.texture.createView()
                }
            ]
        });

        this.projectionViewBindGroup = device.createBindGroup({
            layout: projectionViewBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: projectionViewMatrixBuffer,
                    }
                }
            ]
        });

        this.pipeline = device.createRenderPipeline({
            vertex: vertexState,
            fragment: fragmentState,
            primitive: {
                topology: "triangle-list" // type of primitive to render
            },
            layout: pipelineLayout,
        });

    }
}