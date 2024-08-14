import { Rect } from "../simpleComponents/rect.ts";
import {ComponentType, GameObject, IAction} from "./player.ts";

//in the future use word idable with components
export class CircleCollider implements IAction {
    constructor(public radius: number, public x: number, public y: number) {
    }

    type= ComponentType.Physics;

    static fromRect(drawRect: Rect): CircleCollider {
        const radius = Math.min(drawRect.width, drawRect.height) / 2;
        return new CircleCollider(radius, drawRect.x + radius, drawRect.y + radius);
    }

    update(drawRect: Rect) {
        this.radius = Math.min(drawRect.width, drawRect.height) / 2;
        this.x = drawRect.x + this.radius;
        this.y = drawRect.y + this.radius;
    }

    static intersects(colliderA: CircleCollider, colliderB: CircleCollider): boolean {
        const dx = colliderA.x - colliderB.x;
        const dy = colliderA.y - colliderB.y;
        const distanceSquared = dx * dx + dy * dy;
        const sumOfRadii = colliderA.radius + colliderB.radius;
        return distanceSquared <= sumOfRadii * sumOfRadii;
    }

    performAction(_dt: number, gameObject: GameObject) {
        this.update(gameObject.sprite.drawRect);
    }
}
