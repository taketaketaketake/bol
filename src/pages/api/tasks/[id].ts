import type { APIRoute } from 'astro';
import { db } from '../../../db/client';
import { tasks } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const PATCH: APIRoute = async ({ request, params }) => {
    try {
        const { id } = params;
        if (!id) {
            return new Response(JSON.stringify({ error: 'Task ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await request.json();
        const { isComplete } = data;

        if (typeof isComplete !== "boolean") {
            return new Response(JSON.stringify({ error: 'isComplete must be a boolean' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const [updatedTask] = await db
            .update(tasks)
            .set({ isComplete, updatedAt: new Date() })
            .where(eq(tasks.id, parseInt(id)))
            .returning();

        if (!updatedTask) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(updatedTask), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update task',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const DELETE: APIRoute = async ({ params }) => {
    try {
        const { id } = params;

        if (!id) {
            return new Response(JSON.stringify({ error: 'Task ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const [deletedTask] = await db.delete(tasks)
            .where(eq(tasks.id, parseInt(id)))
            .returning();

        if (!deletedTask) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to delete task',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const prerender = false;