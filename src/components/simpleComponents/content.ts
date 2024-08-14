import {Texture} from "./texture.ts";
import {Rect} from "./rect.ts";


export class Sprite {
    constructor(public texture: Texture | undefined, public drawRect: Rect, public sourceRect: Rect) {
    }
}

export class Content {
    public static gameSpriteSheetTexture: Texture;
    public static otherTexture: Texture;
    public static testTexture: Texture;
    public static bgTexture: Texture;
    public static explosionTexture: Texture;
    public static iceTexture: Texture;
    public static playerTexture: Texture;

    public static sprites: { [id: string]: Sprite } = {};
    private static assetsLoaded: Promise<void>;
    private static resolveAssetsLoaded: () => void;

    // Initialize the assetsLoaded promise
    static {
        Content.assetsLoaded = new Promise((resolve) => {
            Content.resolveAssetsLoaded = resolve;
        });
    }

    public static async loadAssets(device: GPUDevice) {
        // Load all textures here
        Content.gameSpriteSheetTexture = await Texture.createTextureFromURL(device, "src/assets/sheet.png");
        Content.otherTexture = await Texture.createTextureFromURL(device, "https://th.bing.com/th/id/R.f9f44b5f66fab6567c879830b92650f8?rik=%2fCFdqmIZ9g0AAA&pid=ImgRaw&r=0");
        Content.testTexture = await Texture.createTextureFromURL(device, "src/assets/uv_test.png");
        Content.bgTexture = await Texture.createTextureFromURL(device, "src/assets/bg.png");
        Content.explosionTexture = await Texture.createTextureFromURL(device, "src/assets/explosion.png");
        Content.iceTexture = await Texture.createTextureFromURL(device, "src/assets/ice.jpg");

        // Load the sprite sheet
        await Content.loadSpriteSheet("src/assets/sheet.xml", Content.gameSpriteSheetTexture);
        //use sheet.xml to get the player texture coordinates
        //Content.playerTexture = await Texture.createTextureFromPortion(device,Content.gameSpriteSheetTexture.texture, new Rect(224, 832, 99, 75));
        // Resolve the promise to indicate assets are loaded
        Content.resolveAssetsLoaded();
    }

    public static async loadSpriteSheet(url: string, texture: Texture) {
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");

        xml.querySelectorAll("SubTexture").forEach((subTexture) => {
            const name = subTexture.getAttribute("name")!.replace(".png", "");
            const x = parseInt(subTexture.getAttribute("x")!);
            const y = parseInt(subTexture.getAttribute("y")!);
            const width = parseInt(subTexture.getAttribute("width")!);
            const height = parseInt(subTexture.getAttribute("height")!);
            const drawRect = new Rect(250, 0, width, height);
            const sourceRect = new Rect(x, y, width - 1.1, height - 1.1);
            this.sprites[name] = new Sprite(texture, drawRect, sourceRect);
        });
    }

    public static getAssetsLoadedPromise() {
        return Content.assetsLoaded;
    }
}
