import { db } from '../../db/client';
import { tasks } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    if (id) {
      // Get single task
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, parseInt(id))
      });
      
      if (!task) {
        return new Response(JSON.stringify({ error: 'Task not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(task), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get all tasks
      const allTasks = await db.query.tasks.findMany({
        orderBy: (tasks, { desc }) => [desc(tasks.createdAt)]
      });
      
      return new Response(JSON.stringify(allTasks), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch tasks',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { title } = data;
    
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const [newTask] = await db.insert(tasks).values({
      title: title.trim(),
      isComplete: false
    }).returning();
    
    return new Response(JSON.stringify(newTask), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to create task',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Handle all other methods
export const ALL: APIRoute = async ({ request }) => {
  return new Response(JSON.stringify({ 
    error: 'Method not allowed',
    allowedMethods: ['GET', 'POST', 'DELETE'] 
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const prerender = false;