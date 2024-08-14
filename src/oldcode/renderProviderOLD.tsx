import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import shaderSource from '../components/shaders/applyScreenFX.wgsl?raw';
import {QuadGeometry} from './geometry';
import {BufferUtils} from '../components/simpleComponents/bufferUtils.ts';
import {Camera} from "../components/simpleComponents/camera.ts";
import {Content} from "../components/simpleComponents/content.ts";

interface WebGPURenderContextType {
    canvas: HTMLCanvasElement | null;
    context?: GPUCanvasContext;
    device?: GPUDevice;
    drawItems?: (items: any[]) => void;
}


// Utility functions and static data outside the component, reducing the number of times they are redefined
const createPipeline = (device: GPUDevice, textureBindGroupLayout: GPUBindGroupLayout, projectionViewBindGroupLayout: GPUBindGroupLayout) => {
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
        targets: [
            {
                format: navigator.gpu.getPreferredCanvasFormat(),
                blend: {
                    //what should texture do when applied to the screen
                    //aka the target
                    //this means source texture x source alpha + destination texture x 1 - source alpha
                    //this produces a transparent effect allowing the background to show through
                    color: {
                        srcFactor: 'one', //multiply the source by 1
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
        ],
    };

    //this is the pipeline layout that specifies the order of bind groups
    //this means that the projection view bind group will be first and the texture bind group will be second
    //this is important because the shader group has indices that reference the bind group
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [projectionViewBindGroupLayout, textureBindGroupLayout],
    });

    return device.createRenderPipeline({
        vertex: vertexState,
        fragment: fragmentState,
        primitive: { topology: 'triangle-list' },
        layout: pipelineLayout,
    });
};

const initCamera = (canvas: HTMLCanvasElement) => {
    return new Camera(canvas.width, canvas.height);

}



const WebGPURenderContext = createContext<WebGPURenderContextType>({ canvas: null });

export const useWebGPURenderContext = () => useContext(WebGPURenderContext);

export const RenderProviderOLD: React.FC<{ canvasRef: React.RefObject<HTMLCanvasElement>; children: React.ReactNode }> = ({ canvasRef, children }) => {
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
    const [context, setContext] = useState<GPUCanvasContext | undefined>();
    const [device, setDevice] = useState<GPUDevice | undefined>();
    //we use the pipeline to send data from cpu to gpu via buffers
    const [pipeline, setPipeline] = useState<GPURenderPipeline | undefined>();
    //we need to store the buffers in refs so that we can access them in the drawItems function
    // const positionBufferRef = useRef<GPUBuffer | null>(null);
    // const colorBufferRef = useRef<GPUBuffer | null>(null);
    // const textureBufferRef = useRef<GPUBuffer | null>(null);
    ///A bind group in graphics programming refers to a collection of resources,
    // such as textures, buffers, and samplers, that are used by shaders during rendering.
    // The concept of bind groups is designed to optimize the binding of resources to the GPU, making it more efficient to switch between different sets of resources.
    // This is especially important in real-time rendering applications like games or interactive graphics, where performance is critical.
    const [textureBindGroup, setTextureBindGroup] = useState<GPUBindGroup | null>(null);
    //projectionview bind group which is used to store the projection view matrix to be used in the shader
    const [projectionViewBindGroup, setProjectionViewBindGroup] = useState<GPUBindGroup | null>(null);
    //projection view matrix buffer
    const projectionViewMatrixBufferRef = useRef<GPUBuffer | null>(null);
    //we only nw need one interleave buffer instead of 3 separate buffers for position, color, and texture
    const interleaveBufferRef = useRef<GPUBuffer | null>(null);
    //index buffer
    const indexBufferRef = useRef<GPUBuffer | null>(null);
    const cameraRef = useRef<Camera | null>(null);


    useEffect(() => {
        const canvasElement = canvasRef.current;
        if (canvasElement && !canvas) {
            setCanvas(canvasElement);
            const gpuContext = canvasElement.getContext('webgpu');
            if (gpuContext) {
                setContext(gpuContext);
            } else {
                console.error('WebGPU not supported on your browser');
            }
        }
    }, [canvasRef, canvas]);

    useEffect(() => {
        const initializeWebGPU = async () => {
            if (!canvas || !context || device) {
                return;
            }

            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    console.error('No adapter found');
                    return;
                }

                const device = await adapter.requestDevice();
                if (!device) {
                    console.error('Failed to request device');
                    return;
                }

                context.configure({
                    device: device,
                    format: navigator.gpu.getPreferredCanvasFormat(),
                });

                setDevice(device);


                //camera setting order is weird so for now set it here since we know canvas is set
                if (!cameraRef.current) {
                    cameraRef.current = initCamera(canvas);
                }


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

                //we need to create a bind group layout for the texture
                //this will specify the layout of the texture and sampler in the shader

                const textureBindGroupLayout = device.createBindGroupLayout({
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: {},
                        },
                        {
                            binding: 1,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: {},
                        },
                    ],
                });

                //load the texture
                await Content.loadAssets(device);

                //create a pipeline layout using the bind group layout
                const pipeline= createPipeline(device, textureBindGroupLayout, projectionViewBindGroupLayout);
                setPipeline(pipeline);
                //create a bind group using the texture and sampler
                const bindGroup = device.createBindGroup({
                    layout: textureBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: Content.gameSpriteSheetTexture.sampler,
                        },
                        {
                            binding: 1,
                            resource: Content.gameSpriteSheetTexture.texture.createView(),
                        },
                    ],
                });
                //create the buffers after the device is set
                //create a quad geometry which is a square with 2 triangles and 4 vertices and uv coordinates
                const geometry = new QuadGeometry();
                //create a buffer for the projection view matrix
                const projectionViewMatrixBuffer = BufferUtils.createUniformBuffer(device, new Float32Array(16));
                //store the buffer in a ref so that we can access it later
                projectionViewMatrixBufferRef.current = projectionViewMatrixBuffer;
                //create a bind group using the buffer
                const projectionViewBindGroup = device.createBindGroup({
                    layout: projectionViewBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: projectionViewMatrixBuffer,
                            },
                        },
                    ],
                });
                //store the bind group in a ref so that we can access it later
                setTextureBindGroup(bindGroup);
                //store the bind group in a ref so that we can access it later
                setProjectionViewBindGroup(projectionViewBindGroup);
                // positionBufferRef.current = BufferUtils.createVertexBuffer(device, new Float32Array(geometry.positions));
                // colorBufferRef.current = BufferUtils.createVertexBuffer(device, new Float32Array(geometry.colors));
                // textureBufferRef.current = BufferUtils.createVertexBuffer(device, new Float32Array(geometry.texCoords));
                //create the interleave buffer and store it in a ref
                interleaveBufferRef.current = BufferUtils.createVertexBuffer(device, new Float32Array(geometry.vertexData));
                //create the index buffer and store it in a ref
                indexBufferRef.current = BufferUtils.createIndexBuffer(device, new Uint16Array(geometry.indices));
            } catch (error) {
                console.error('Error initializing WebGPU:', error);
            }
        };

        initializeWebGPU();
        //recently updated where device is now a hook reducing overall usestate hooks for buffers
    }, [canvas, context, device]);

    //we have to passing the device to the buffer so that it can be created or else it will believe that the device is not ready


    const drawItems = useCallback((items: any[]) => {
        if (!canvas || !context || !device || !pipeline || !interleaveBufferRef.current|| !textureBindGroup) {
            console.error('Cannot draw: Canvas, context, device, pipeline, buffers, or texture bind group not initialized.');
            return;
        }

        cameraRef.current?.update();

        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.8, g: 0.8, b: 0.8, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        //set the projection view matrix buffer so we can see the sprite
        device.queue.writeBuffer(
            projectionViewMatrixBufferRef.current!,
            0,
            cameraRef.current?.projectionViewMatrix as Float32Array);


        //set the pipeline before drawing
        passEncoder.setPipeline(pipeline);
        //set buffers
        passEncoder.setIndexBuffer(indexBufferRef.current!, 'uint16');
        // passEncoder.setVertexBuffer(0, positionBufferRef.current);
        // passEncoder.setVertexBuffer(1, colorBufferRef.current);
        // passEncoder.setVertexBuffer(2, textureBufferRef.current);

        //set the interleave buffer
        passEncoder.setVertexBuffer(0, interleaveBufferRef.current);
        passEncoder.setBindGroup(0, projectionViewBindGroup);
        //set the bind group
        passEncoder.setBindGroup(1, textureBindGroup);

        items.forEach(item => {
            // Add logic to draw item
        });
        //draw 3 vertices to make a triangle
        //(3 vertices * 2 triangles = 6 vertices) using 4 indices
        passEncoder.drawIndexed(6);

        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
    }, [canvas, context, device, pipeline, projectionViewBindGroup, textureBindGroup]);

    return (
        <WebGPURenderContext.Provider value={{ canvas, context, device, drawItems }}>
            {children}
        </WebGPURenderContext.Provider>
    );
};