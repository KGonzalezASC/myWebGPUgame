import React, { useRef } from 'react';
import {RenderProvider, useWebGPURenderContext} from "./components/rendererProvider.tsx";
import {GameObject, Player} from "./components/game/player.ts";
import {Content} from "./components/simpleComponents/content.ts";
import {Background} from "./components/game/background.ts";
import {ObstacleManager} from "./components/game/obstacleManager.ts";

const Engine: React.FC = () => {
    const { drawItems, inputManager,device  } = useWebGPURenderContext();
    const handleDraw = async () => {
        if (drawItems) {
            const p = new Player("playerShip1_red", inputManager!,device!, 624, 692);
            await p.effectManager.initEffects([]) //we need to await the textures to be loaded before we can draw  'greyFX','blurFX'

            const itemsToDraw: GameObject[] = [
                // Using canvas directly to get width and height from content.js so if u request too fast it will not be loaded
                // For now since we are not resizing the canvas we can just hard code the width and height
                new Background(624, 692),
                p,
                new ObstacleManager(624, 692, p),
            ];
            // This callback will pass the items to the renderer to the draw function
            drawItems(itemsToDraw);
        }
    };

    const [isLoaded, setIsLoaded] = React.useState(false);
    React.useEffect(() => {
        const loadAssets = async () => {
            await Content.getAssetsLoadedPromise();
            setIsLoaded(true);
        };
        loadAssets();
    }, []);
    // Return the button only after Content.getAssetsLoadedPromise is resolved
    return (
        <>
            {isLoaded ? <button onClick={handleDraw}>Start Game</button> : <p>Loading...</p>}
        </>
    );
};


const App: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    return (
        <RenderProvider canvasRef={canvasRef}>
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw',}}>
              <canvas ref={canvasRef} width="624" height="692" style={{ border: '1px solid black' }}/>
            </div>
            <Engine/>
        </RenderProvider>
    );
};



export default App;
