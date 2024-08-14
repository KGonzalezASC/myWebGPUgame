import { Rect } from "../simpleComponents/rect.ts";
import { SpriteRenderer } from "../spriteRenderer.ts";
import { Sprite } from "../simpleComponents/content.ts";
import { Obstacle } from "./obstacle.ts";
import {GameObject, Player} from "./player.ts";
import { CircleCollider } from "./circleCollider.ts";
import { Explosion } from "./explosion.ts";

const SPAWN_INTERVAL = 15;
const MAX_POOL_SIZE = 30; // Maximum pool size to prevent memory overflow


export class ObstacleManager implements GameObject {
    private timeToSpawn = 0;
    private obstaclePool: Obstacle[] = [];
    private explosionPool: Explosion[] = [];
    private player: Player;

    sprite: Sprite = new Sprite(undefined, new Rect(), new Rect());

    constructor(private gameWidth: number, private gameHeight: number, player: Player) {
        this.player = player;
    }

    private createExplosion(drawRect: Rect) {
        let explosion = this.explosionPool.find(e => !e.playing);
        // if not found, create a new one
        if (!explosion) {
            explosion = new Explosion();
            this.explosionPool.push(explosion);
        }

        explosion.play(drawRect);
    }

    private spawnObstacle() {
        if (this.timeToSpawn > SPAWN_INTERVAL) {
            this.timeToSpawn = 0;
            let o = this.obstaclePool.find(e => !e.active);

            if (!o) {
                o = new Obstacle();
                this.obstaclePool.push(o);
            }

            o.active = true;
            o.sprite.drawRect.x = Math.random() * (this.gameWidth - o.sprite.drawRect.width);
            o.sprite.drawRect.y = -o.sprite.drawRect.height;
        }
    }

    public update(dt: number) {
        this.timeToSpawn += dt;
        this.spawnObstacle();

        for (const o of this.obstaclePool) {
            if (o.active) {
                o.update(dt);
                // Check collisions
                if (CircleCollider.intersects(o.collider, this.player.collider)) {
                    this.createExplosion(o.sprite.drawRect);
                    o.active = false;

                }

                if (o.sprite.drawRect.y > this.gameHeight) {
                    o.active = false;
                }
            }
        }

        // Update explosions
        for (const explosion of this.explosionPool) {
            if (explosion.playing) {
                explosion.update(dt);
            }
        }


        if (this.obstaclePool.length > MAX_POOL_SIZE) {
            this.cleanupInactiveObstacles();
        }
    }

    public draw(spriteRenderer: SpriteRenderer) {
        // Draw obstacles
        for (const o of this.obstaclePool) {
            if (o.active) {
                o.draw(spriteRenderer);
            }
        }

        // Draw explosions
        for (const explosion of this.explosionPool) {
            if (explosion.playing) {
                explosion.draw(spriteRenderer);
            }
        }
    }

    private cleanupInactiveObstacles() {
        this.obstaclePool = this.obstaclePool.filter(o => {
            if (!o.active) {
                o.cleanup();
                return false;
            }
            return true;
        });
    }
}
