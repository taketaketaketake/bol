# SMS AI Agent Implementation Plan

## Overview

This document outlines the implementation of an SMS-based AI agent for Bags of Laundry that handles customer interactions via text message to +1-855-927-4224.

**Core Capabilities:**
- New order intake via SMS
- Order status queries
- Special request capture and approval workflow
- Intelligent routing based on conversation context
- Human escalation when needed
- Integration with existing order management system

**Technology Stack:**
- Telnyx for SMS messaging
- Anthropic Claude API for AI responses
- PostgreSQL (Supabase) for conversation state
- Existing Astro/React frontend for admin dashboard

---

## Database Schema Changes

### New Tables

#### `sms_conversations`
Tracks ongoing SMS conversations with customers.

```sql
CREATE TABLE sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  current_intent TEXT, -- 'new_order', 'status_check', 'support', 'human_escalation'
  conversation_state JSONB DEFAULT '{}', -- Stores context between messages
  handled_by TEXT DEFAULT 'agent', -- 'agent' or 'zach'
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_phone_number (phone_number),
  INDEX idx_last_message (last_message_at DESC)
);
```

#### `sms_messages`
Message history for all SMS conversations.

```sql
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES sms_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'inbound' or 'outbound'
  message_text TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  telnyx_message_id TEXT,
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_conversation (conversation_id, created_at),
  INDEX idx_telnyx_id (telnyx_message_id)
);
```

#### `pending_approvals`
Special requests awaiting Zach's approval.

```sql
CREATE TABLE pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  conversation_id UUID REFERENCES sms_conversations(id),
  request_type TEXT NOT NULL, -- 'special_instruction', 'pricing_exception', 'urgent_delivery'
  request_details JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  zach_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,

  INDEX idx_status (status),
  INDEX idx_created (created_at DESC)
);
```

#### `agent_notifications`
Notifications sent to Zach.

```sql
CREATE TABLE agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'approval_needed', 'escalation', 'error'
  conversation_id UUID REFERENCES sms_conversations(id),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent', -- 'sent', 'read', 'acted'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_status_created (status, created_at DESC)
);
```

### Schema Updates to Existing Tables

```sql
-- Add to orders table
ALTER TABLE orders
  ADD COLUMN sms_conversation_id UUID REFERENCES sms_conversations(id),
  ADD COLUMN special_requests JSONB DEFAULT '[]';

-- Add to customers table (if not exists)
ALTER TABLE customers
  ADD COLUMN phone_number TEXT,
  ADD COLUMN sms_notifications_enabled BOOLEAN DEFAULT true;
```

### Migration File

Create: `database-migrations/sms-agent-schema.sql`

---

## API Endpoints

### 1. `/api/telnyx/sms-webhook.ts`

**Purpose:** Main webhook for receiving inbound SMS from Telnyx

**Request (from Telnyx):**
```typescript
{
  "data": {
    "event_type": "message.received",
    "id": "msg_...",
    "occurred_at": "2025-11-17T...",
    "payload": {
      "id": "msg_...",
      "from": {
        "phone_number": "+12102697509"
      },
      "to": [{
        "phone_number": "+18559274224"
      }],
      "text": "I need a pickup today"
    }
  }
}
```

**Implementation Flow:**
1. Verify Telnyx webhook signature
2. Extract phone number and message text
3. Look up or create conversation record
4. Check if conversation is handled by human (Zach)
5. If agent-handled, pass to AI processor
6. If human-handled, notify Zach and log message
7. Send response via Telnyx API

**Key Functions:**
- `verifyTelnyxSignature(request)`
- `getOrCreateConversation(phoneNumber)`
- `isHandledByHuman(conversationId)`
- `processWithAI(conversationId, messageText)`
- `sendSMSResponse(toNumber, messageText)`

### 2. `/api/sms-agent/process-message.ts`

**Purpose:** Core AI agent logic for processing customer messages

**Request:**
```typescript
{
  "conversation_id": "uuid",
  "phone_number": "+12102697509",
  "message_text": "I need a pickup today"
}
```

**Response:**
```typescript
{
  "response_text": "Absolutely! I can help you schedule that. What's your pickup address?",
  "intent": "new_order",
  "requires_human": false,
  "tool_calls": []
}
```

**Implementation:**
1. Load conversation history from database
2. Determine or update conversation intent
3. Build Claude API request with appropriate system prompt
4. Process AI response and tool calls
5. Execute tools (check availability, create order, etc.)
6. Update conversation state
7. Return response text

### 3. `/api/sms-agent/send-message.ts`

**Purpose:** Send outbound SMS via Telnyx API

**Request:**
```typescript
{
  "to": "+12102697509",
  "text": "Your order is confirmed!",
  "conversation_id": "uuid"
}
```

**Implementation:**
1. Call Telnyx Messaging API
2. Log message to sms_messages table
3. Handle errors and retries
4. Return delivery status

### 4. `/api/sms-agent/notify-zach.ts`

**Purpose:** Send notifications to Zach when agent needs help

**Request:**
```typescript
{
  "type": "approval_needed" | "escalation" | "error",
  "conversation_id": "uuid",
  "details": "Customer requested starch and press"
}
```

**Implementation:**
1. Load conversation context
2. Format notification message
3. Send SMS to Zach's phone
4. Log to agent_notifications table
5. Update conversation state if escalation

### 5. `/api/sms-agent/approve-request.ts`

**Purpose:** Zach approves/rejects special requests

**Request:**
```typescript
{
  "approval_id": "uuid",
  "status": "approved" | "rejected",
  "response": "Yes, we can do starch and press for $5 extra"
}
```

**Implementation:**
1. Update pending_approvals record
2. Get associated conversation
3. Send customer response via SMS
4. Update order with approved special requests
5. Continue conversation flow

### 6. `/api/sms-agent/tools/check-availability.ts`

**Purpose:** Check service availability for postal code

**Reuses:** Existing `/api/check-availability.ts` logic

### 7. `/api/sms-agent/tools/create-order.ts`

**Purpose:** Create new order from SMS conversation

**Reuses:** Existing `/api/create-order.ts` logic with additions:
- Link to sms_conversation_id
- Include special_requests JSON
- Send payment link via SMS instead of email

### 8. `/api/sms-agent/tools/get-order-status.ts`

**Purpose:** Get customer's order status by phone number

**Implementation:**
```typescript
// Query orders by phone number
const orders = await db
  .select({
    id: ordersTable.id,
    status: ordersTable.status,
    pickup_time: ordersTable.pickup_time_window,
    delivery_time: ordersTable.delivery_time_window,
    created_at: ordersTable.created_at
  })
  .from(ordersTable)
  .where(eq(ordersTable.customer_phone, phoneNumber))
  .orderBy(desc(ordersTable.created_at))
  .limit(3);

return formatOrderStatus(orders);
```

---

## AI Integration

### Claude API Configuration

**Model:** `claude-3-5-sonnet-20241022`

**Key Features Used:**
- Tool calling (function execution)
- Multi-turn conversations
- Structured outputs
- Context management

### System Prompts

#### New Order Intent

```typescript
const NEW_ORDER_PROMPT = `You are a friendly SMS assistant for Bags of Laundry, a laundry pickup & delivery service in Detroit.

Your job: Help customers schedule laundry pickup via text message.

IMPORTANT CONTEXT:
- You're texting with customers, so be conversational and concise
- Customer might not know all details upfront - guide them step by step
- Mirror the friendly, helpful tone from the example conversation

KEY INFORMATION:
- Pricing: $2.25/lb ($35 minimum) for non-members, $1.75/lb for members
- Service area: Detroit metro area (verify by postal code)
- Services offered:
  * Wash & fold (standard)
  * Dry cleaning (per piece pricing)
  * Special services: starch & press, unscented detergent, specific folding
- Payment: Stripe link sent after order confirmed
- Typical turnaround: Same-day or next-day delivery

CONVERSATION FLOW:
1. Greet customer warmly
2. Get pickup address (full street address + postal code)
3. Use check_availability tool to verify service and get time windows
4. Present available time windows
5. Ask about service type (wash & fold, dry cleaning, both)
6. Ask about special requests
7. For special requests: acknowledge and use flag_for_approval tool
8. Create order using create_order tool
9. Confirm order and explain payment link will be sent

SPECIAL REQUEST HANDLING:
When customer asks for:
- Starch & press
- Unscented detergent
- Specific folding preferences
- Urgent timing (same day, specific delivery time)
- Any non-standard request

DO THIS:
1. Acknowledge: "I've noted that"
2. Use flag_for_approval tool with details
3. Tell customer: "Zach will confirm we can accommodate this and reach out if there are any questions"
4. Continue with order creation

PRICING EXCEPTIONS:
If customer questions the $35 minimum or pricing:
- Acknowledge their concern
- Use flag_for_approval tool with type "pricing_exception"
- Let Zach decide on flexibility

TONE GUIDELINES:
- Be friendly but professional
- Use natural language: "Absolutely!", "No problem", "Glad I can help"
- Keep messages concise (SMS format)
- Don't use corporate jargon
- Match the customer's communication style

EXAMPLE INTERACTION:
Customer: "I need a pickup today"
You: "Absolutely! I can help you schedule that. What's your pickup address?"

Customer: "123 Main St, 48201"
You: [use check_availability tool]
You: "Great, we service that area. Available time windows today:
• 2-4pm
• 6-8pm
Which works better?"

Customer: "6-8pm. Do you do dry cleaning?"
You: "We do! Our standard service is wash & fold at $2.25/lb ($35 minimum). Dry cleaning items are priced per piece. How many items need dry cleaning?"

Customer: "Just one suit jacket"
You: "Perfect. I've noted:
• Wash & fold pickup at 123 Main St
• 6-8pm window today
• 1 suit jacket for dry cleaning

Any other special instructions?"

Customer: "Can you use unscented detergent?"
You: "I've noted that request. Zach will confirm we can accommodate it and will reach out if there are any questions.

To confirm your order, I'll send a payment authorization link. Sound good?"

AVAILABLE TOOLS:
- check_availability: Verify service area and get time windows
- create_order: Create the order in the system
- flag_for_approval: Flag special requests for Zach's review
- escalate_to_zach: Transfer to human when you can't help

When to escalate_to_zach:
- Customer is upset or complaining
- Request is highly unusual
- You've tried to help but conversation is going in circles
- Customer explicitly asks for a human`;
```

#### Order Status Intent

```typescript
const ORDER_STATUS_PROMPT = `You are helping a customer check their laundry order status via SMS.

Your job: Provide clear, helpful updates on their order.

AVAILABLE TOOLS:
- get_order_status: Look up orders by phone number

FLOW:
1. Use get_order_status tool with customer's phone number
2. If multiple orders, ask which one they're asking about
3. Provide clear status update with timing
4. Offer to help with anything else

ORDER STATUSES:
- scheduled: "Your pickup is scheduled for [time]"
- en_route_pickup: "We're on our way to pick up your laundry!"
- picked_up: "Your laundry has been picked up and is being processed"
- processing: "Your laundry is currently being processed at the laundromat"
- ready_for_delivery: "Your laundry is ready! Delivery scheduled for [time]"
- delivered: "Your laundry has been delivered"
- completed: "Order completed"

TONE:
- Friendly and reassuring
- Proactive: "I'll text when we're 15 minutes away!"
- If delayed: Be honest and apologetic

EXAMPLE:
Customer: "How's it going?"
You: [use get_order_status tool]
You: "Your order is currently being processed at the laundromat. Estimated delivery by 8pm tonight to 123 Main St. I'll text when we're 15 minutes away!"`;
```

#### Support Intent

```typescript
const SUPPORT_PROMPT = `You are handling a support request or complaint for Bags of Laundry via SMS.

Your job: Listen, empathize, gather details, and escalate to Zach.

IMPORTANT:
- Most support issues should be escalated to Zach
- Your role is to gather information and show empathy
- Don't make promises you can't keep

FLOW:
1. Acknowledge the issue with empathy
2. Ask clarifying questions if needed
3. Use escalate_to_zach tool with full details
4. Tell customer Zach will reach out personally

COMMON ISSUES:
- Late pickup/delivery
- Quality concerns (wrinkled, smells, stains not removed)
- Missing items
- Billing questions
- Damaged items

TONE:
- Empathetic and apologetic
- Take concerns seriously
- Don't be defensive
- Assure personal follow-up

EXAMPLE:
Customer: "My shirts are wrinkled"
You: "I'm sorry to hear that - we want your laundry to be perfect. Can you tell me which items are wrinkled? I'll escalate this to Zach immediately."

Customer: "The white dress shirts, all 3 of them"
You: [use escalate_to_zach with details]
You: "Thank you for letting me know. I've flagged this for Zach and he'll reach out personally to make this right."`;
```

### Tool Definitions

```typescript
const AGENT_TOOLS = [
  {
    name: "check_availability",
    description: "Check if we service a postal code and get available pickup/delivery time windows for today and upcoming days",
    input_schema: {
      type: "object",
      properties: {
        postal_code: {
          type: "string",
          description: "5-digit postal code"
        },
        service_type: {
          type: "string",
          enum: ["wash_fold", "dry_clean", "both"],
          description: "Type of service requested"
        }
      },
      required: ["postal_code", "service_type"]
    }
  },
  {
    name: "create_order",
    description: "Create a new laundry order in the system",
    input_schema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        email: {
          type: "string",
          description: "Customer email (optional for SMS orders)"
        },
        pickup_address: {
          type: "string",
          description: "Full street address"
        },
        postal_code: { type: "string" },
        time_window_id: {
          type: "string",
          description: "ID of selected time window from check_availability"
        },
        service_type: {
          type: "string",
          enum: ["wash_fold", "dry_clean", "both"]
        },
        special_requests: {
          type: "array",
          items: { type: "string" },
          description: "List of special requests (even if flagged for approval)"
        },
        notes: {
          type: "string",
          description: "Additional order notes"
        }
      },
      required: ["phone_number", "pickup_address", "postal_code", "time_window_id", "service_type"]
    }
  },
  {
    name: "get_order_status",
    description: "Get status of customer's recent orders by phone number",
    input_schema: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "Customer's phone number"
        }
      },
      required: ["phone_number"]
    }
  },
  {
    name: "flag_for_approval",
    description: "Flag a special request or exception for Zach's approval. Use this for special service requests, pricing exceptions, or urgent timing needs.",
    input_schema: {
      type: "object",
      properties: {
        request_type: {
          type: "string",
          enum: ["special_instruction", "pricing_exception", "urgent_delivery", "service_question"],
          description: "Type of request needing approval"
        },
        details: {
          type: "string",
          description: "Full details of the request"
        },
        conversation_id: {
          type: "string",
          description: "Current conversation ID"
        },
        customer_phone: {
          type: "string",
          description: "Customer's phone number"
        }
      },
      required: ["request_type", "details", "conversation_id", "customer_phone"]
    }
  },
  {
    name: "escalate_to_zach",
    description: "Transfer the conversation to Zach when the AI agent cannot handle it. Use for complaints, complex issues, or when customer requests human assistance.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why this conversation needs human attention"
        },
        conversation_id: {
          type: "string",
          description: "Current conversation ID"
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Urgency of escalation"
        }
      },
      required: ["reason", "conversation_id"]
    }
  }
];
```

### Tool Execution Logic

```typescript
// /src/lib/sms-agent/tools.ts

import { db } from "@/db";
import { ordersTable, pendingApprovalsTable, smsConversationsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function executeTool(toolName: string, toolInput: any) {
  switch (toolName) {
    case "check_availability":
      return await checkAvailability(toolInput);

    case "create_order":
      return await createOrderFromSMS(toolInput);

    case "get_order_status":
      return await getOrderStatus(toolInput);

    case "flag_for_approval":
      return await flagForApproval(toolInput);

    case "escalate_to_zach":
      return await escalateToZach(toolInput);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function checkAvailability(input: { postal_code: string; service_type: string }) {
  // Call existing availability API
  const response = await fetch(`${process.env.SITE_URL}/api/check-availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postal_code: input.postal_code,
      service_type: input.service_type
    })
  });

  const data = await response.json();

  if (!data.available) {
    return {
      available: false,
      message: "Sorry, we don't currently service that area."
    };
  }

  return {
    available: true,
    time_windows: data.windows,
    service_zone: data.zone
  };
}

async function createOrderFromSMS(input: any) {
  const { conversation_id, phone_number, email, pickup_address, postal_code, time_window_id, service_type, special_requests, notes } = input;

  // Create order using existing API
  const response = await fetch(`${process.env.SITE_URL}/api/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_phone: phone_number,
      customer_email: email || null,
      pickup_address,
      postal_code,
      time_window_id,
      service_type,
      special_requests: special_requests || [],
      notes,
      sms_conversation_id: conversation_id,
      source: "sms"
    })
  });

  const order = await response.json();

  // Send payment link via SMS
  if (order.payment_link) {
    await sendSMS(phone_number,
      `Order confirmed! To complete your booking, please authorize payment here: ${order.payment_link}\n\n` +
      `You'll only be charged after we weigh your laundry at pickup.`
    );
  }

  return {
    success: true,
    order_id: order.id,
    order_number: order.order_number,
    payment_link_sent: true
  };
}

async function getOrderStatus(input: { phone_number: string }) {
  const orders = await db
    .select({
      id: ordersTable.id,
      order_number: ordersTable.order_number,
      status: ordersTable.status,
      pickup_address: ordersTable.pickup_address,
      pickup_time_start: ordersTable.pickup_time_start,
      pickup_time_end: ordersTable.pickup_time_end,
      delivery_time_start: ordersTable.delivery_time_start,
      delivery_time_end: ordersTable.delivery_time_end,
      created_at: ordersTable.created_at
    })
    .from(ordersTable)
    .where(eq(ordersTable.customer_phone, input.phone_number))
    .orderBy(desc(ordersTable.created_at))
    .limit(5);

  if (orders.length === 0) {
    return {
      found: false,
      message: "No orders found for this phone number"
    };
  }

  return {
    found: true,
    orders: orders.map(order => ({
      order_number: order.order_number,
      status: order.status,
      pickup_window: `${order.pickup_time_start} - ${order.pickup_time_end}`,
      delivery_window: order.delivery_time_start ?
        `${order.delivery_time_start} - ${order.delivery_time_end}` : null,
      created_at: order.created_at
    }))
  };
}

async function flagForApproval(input: { request_type: string; details: string; conversation_id: string; customer_phone: string }) {
  // Create pending approval
  const [approval] = await db
    .insert(pendingApprovalsTable)
    .values({
      conversation_id: input.conversation_id,
      request_type: input.request_type,
      request_details: {
        details: input.details,
        customer_phone: input.customer_phone
      },
      status: "pending"
    })
    .returning();

  // Notify Zach
  await notifyZach({
    type: "approval_needed",
    conversation_id: input.conversation_id,
    details: input.details,
    approval_id: approval.id
  });

  return {
    success: true,
    message: "Request flagged for Zach's approval"
  };
}

async function escalateToZach(input: { reason: string; conversation_id: string; priority?: string }) {
  // Update conversation to human-handled
  await db
    .update(smsConversationsTable)
    .set({
      handled_by: "zach",
      current_intent: "human_escalation"
    })
    .where(eq(smsConversationsTable.id, input.conversation_id));

  // Notify Zach
  await notifyZach({
    type: "escalation",
    conversation_id: input.conversation_id,
    details: input.reason,
    priority: input.priority || "medium"
  });

  return {
    success: true,
    message: "Conversation transferred to Zach"
  };
}
```

---

## Notification System

### Notify Zach Function

```typescript
// /src/lib/sms-agent/notifications.ts

import { db } from "@/db";
import { smsConversationsTable, smsMessagesTable, agentNotificationsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { sendSMS } from "./messaging";

export async function notifyZach(params: {
  type: "approval_needed" | "escalation" | "error";
  conversation_id: string;
  details: string;
  approval_id?: string;
  priority?: string;
}) {
  const { type, conversation_id, details, approval_id, priority } = params;

  // Get conversation context
  const conversation = await db
    .select()
    .from(smsConversationsTable)
    .where(eq(smsConversationsTable.id, conversation_id))
    .limit(1);

  if (!conversation.length) {
    throw new Error("Conversation not found");
  }

  const conv = conversation[0];

  // Get recent messages for context
  const recentMessages = await db
    .select()
    .from(smsMessagesTable)
    .where(eq(smsMessagesTable.conversation_id, conversation_id))
    .orderBy(desc(smsMessagesTable.created_at))
    .limit(5);

  const messageHistory = recentMessages
    .reverse()
    .map(m => `${m.direction === 'inbound' ? '👤' : '🤖'}: ${m.message_text}`)
    .join('\n');

  // Build notification message
  let notificationText = "";

  if (type === "approval_needed") {
    notificationText =
      `🔔 Special Request Approval\n\n` +
      `Customer: ${conv.phone_number}\n` +
      `Request: ${details}\n\n` +
      `Recent conversation:\n${messageHistory}\n\n` +
      `View: ${process.env.SITE_URL}/admin/approvals/${approval_id}`;
  }

  if (type === "escalation") {
    const priorityEmoji = priority === "urgent" ? "🚨" : priority === "high" ? "⚠️" : "ℹ️";
    notificationText =
      `${priorityEmoji} Agent Escalation\n\n` +
      `Customer: ${conv.phone_number}\n` +
      `Reason: ${details}\n\n` +
      `Recent conversation:\n${messageHistory}\n\n` +
      `Reply to this number to continue the conversation.`;
  }

  if (type === "error") {
    notificationText =
      `❌ Agent Error\n\n` +
      `Customer: ${conv.phone_number}\n` +
      `Error: ${details}\n\n` +
      `Conversation may need manual intervention.`;
  }

  // Send SMS notification to Zach
  await sendSMS(
    process.env.YOUR_NOTIFICATION_PHONE!,
    notificationText
  );

  // Log notification
  await db.insert(agentNotificationsTable).values({
    type,
    conversation_id,
    message: notificationText,
    status: "sent"
  });

  return { success: true };
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Basic SMS send/receive infrastructure

**Tasks:**
- [ ] Create database migration for new tables
- [ ] Set up Telnyx webhook endpoint `/api/telnyx/sms-webhook.ts`
- [ ] Implement basic SMS sending function
- [ ] Test can receive SMS and reply with static message
- [ ] Set up conversation tracking in database

**Deliverable:** Can receive SMS to +1-855-927-4224 and reply with "Thanks for your message!"

### Phase 2: AI Integration (Week 1-2)
**Goal:** Working AI agent for new orders

**Tasks:**
- [ ] Set up Anthropic Claude API integration
- [ ] Implement `/api/sms-agent/process-message.ts` with Claude
- [ ] Create system prompts for new order intent
- [ ] Implement tool calling infrastructure
- [ ] Build `check_availability` tool integration
- [ ] Build `create_order` tool integration
- [ ] Test full new order flow via SMS

**Deliverable:** Customer can text to schedule pickup, agent handles full conversation and creates order

### Phase 3: Special Requests & Notifications (Week 2)
**Goal:** Human-in-the-loop for edge cases

**Tasks:**
- [ ] Implement `flag_for_approval` tool
- [ ] Build notification system to Zach's phone
- [ ] Create pending approvals workflow
- [ ] Implement payment link sending via SMS
- [ ] Test approval workflow end-to-end

**Deliverable:** Agent flags special requests, Zach gets notified, can approve via dashboard

### Phase 4: Status & Support (Week 2-3)
**Goal:** Handle order tracking and support queries

**Tasks:**
- [ ] Implement `get_order_status` tool
- [ ] Create status check system prompt
- [ ] Implement `escalate_to_zach` tool
- [ ] Create support system prompt
- [ ] Test "How's it going?" type queries
- [ ] Test escalation workflow

**Deliverable:** Agent can answer status questions and escalate support issues

### Phase 5: Admin Dashboard (Week 3)
**Goal:** UI for Zach to manage agent

**Tasks:**
- [ ] Create `/admin/sms-conversations` page
- [ ] Create `/admin/approvals` page
- [ ] Build conversation viewer component
- [ ] Implement quick approval buttons
- [ ] Add analytics/metrics dashboard
- [ ] Build "take over conversation" feature

**Deliverable:** Simple admin interface to view conversations and pending approvals

### Phase 6: Refinement (Week 3-4)
**Goal:** Production-ready system

**Tasks:**
- [ ] Add conversation context improvements (remember customer preferences)
- [ ] Handle edge cases (multiple orders, rescheduling, cancellations)
- [ ] Implement rate limiting and abuse prevention
- [ ] Add comprehensive error handling
- [ ] Set up monitoring and alerts
- [ ] Load testing with simulated conversations
- [ ] Documentation for common scenarios

**Deliverable:** Production-ready SMS agent

---

## Environment Variables

Add to `.env`:

```bash
# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Telnyx SMS
TELNYX_API_KEY=KEY...
TELNYX_PUBLIC_KEY=... # for webhook signature verification
TELNYX_MESSAGING_PROFILE_ID=...
SMS_FROM_NUMBER=+18559274224

# Notifications
YOUR_NOTIFICATION_PHONE=+1... # Zach's phone for notifications

# Site URL (for payment links and admin dashboard)
SITE_URL=https://bagsoflaundry.com
```

---

## Cost Analysis

### Monthly Costs (based on 100 conversations/day)

**Telnyx SMS:**
- Inbound: $0.004/SMS × 300 messages/day = $1.20/day
- Outbound: $0.004/SMS × 300 messages/day = $1.20/day
- **Total SMS: ~$72/month**

**Anthropic Claude API:**
- Average conversation: 5 messages @ ~500 tokens each
- Input: $0.003 per 1K tokens
- Output: $0.015 per 1K tokens
- Per conversation: ~$0.02
- 100 conversations/day × $0.02 = $2/day
- **Total AI: ~$60/month**

**Infrastructure:**
- Existing Supabase/Netlify (no additional cost)
- **Total: $0/month**

**Grand Total: ~$130/month**

**Cost per conversation: ~$0.043**

### Scaling Costs

At 500 conversations/day: ~$650/month
At 1000 conversations/day: ~$1,300/month

**Note:** These are maximum estimates. Actual costs will be lower as many conversations are 2-3 messages, not 5.

---

## Testing Strategy

### Unit Tests
- SMS webhook signature verification
- Tool execution functions
- Intent detection logic
- Message formatting

### Integration Tests
- Full conversation flows (new order, status check, support)
- Tool calling with real database
- Payment link generation
- Notification delivery

### End-to-End Tests
- Real SMS conversations with test phone numbers
- Multi-turn conversations with context preservation
- Escalation workflows
- Approval workflows

### Test Scenarios

**Happy Path - New Order:**
1. Customer texts "I need a pickup"
2. Agent asks for address
3. Customer provides "123 Main St, 48201"
4. Agent checks availability, shows time windows
5. Customer selects time
6. Agent asks about service type
7. Customer says "wash and fold"
8. Agent creates order, sends payment link
9. Customer pays
10. Agent confirms order

**Edge Case - Special Request:**
1. Customer requests starch and press
2. Agent acknowledges and flags for approval
3. Zach gets notification
4. Zach approves with pricing
5. Agent updates customer
6. Order proceeds

**Edge Case - Support Issue:**
1. Customer complains about quality
2. Agent empathizes and gathers details
3. Agent escalates to Zach
4. Zach gets notification with context
5. Zach takes over conversation

---

## Security Considerations

### Webhook Security
- Verify Telnyx signature on all inbound webhooks
- Use HTTPS only
- Rate limit webhook endpoint

### Data Privacy
- Store phone numbers securely
- Encrypt sensitive conversation data
- Implement data retention policy (delete old conversations after 90 days)
- GDPR/CCPA compliance for customer data

### AI Safety
- Prompt injection protection (sanitize user inputs)
- Rate limiting per phone number (prevent spam)
- Profanity/abuse detection and auto-escalation
- Never expose system prompts or API keys in responses

### Payment Security
- Never collect card details via SMS
- Only send Stripe-hosted payment links
- Verify payment status before order confirmation

---

## Monitoring & Analytics

### Metrics to Track

**Conversation Metrics:**
- Total conversations per day/week/month
- Average messages per conversation
- Intent distribution (new_order vs status vs support)
- Completion rate (conversations that result in orders)

**Performance Metrics:**
- Average response time
- AI API latency
- SMS delivery rate
- Error rate

**Business Metrics:**
- Orders created via SMS
- Conversion rate (conversations → orders)
- Average order value from SMS
- Customer satisfaction (track complaints/escalations)

**Agent Metrics:**
- Escalation rate (how often agent needs human help)
- Approval request rate
- Tool call success rate
- Most common intents

### Alerts to Configure

- High error rate (>5% in 1 hour)
- AI API failures
- SMS delivery failures
- Unusually high escalation rate
- Spam/abuse detection

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

**Proactive Notifications:**
- "We're 15 minutes away for pickup"
- "Your laundry is ready for delivery"
- "Your delivery is complete"

**Rescheduling:**
- Customer can text to change pickup time
- Agent checks new availability
- Updates order automatically (or flags for approval if complex)

**Cancellations:**
- Customer can cancel via SMS
- Agent handles cancellation logic
- Refunds if payment already captured

**Multi-Order Management:**
- Handle customers with multiple active orders
- "Which order are you asking about?"
- Track order context in conversation

**Smart Follow-ups:**
- "How did we do?" after delivery
- Request reviews from happy customers
- Re-engagement for lapsed customers

**Spanish Language Support:**
- Detect language preference
- Bilingual agent responses
- Separate system prompts for Spanish

### Advanced Features

**Voice Integration:**
- Transcribe voicemails to SMS agent
- Customer can call and agent responds via SMS with update

**Image Support:**
- Customer sends photo of stains
- Agent logs to order notes
- Flags for special attention

**Loyalty Program Integration:**
- Track repeat customers
- Offer discounts via SMS
- Membership upsells

**Route Optimization Integration:**
- Agent knows driver location
- Provides accurate ETAs
- Handles "where's my driver?" queries

---

## Rollout Plan

### Soft Launch (Week 1-2)
- Deploy to production but don't advertise
- Test with friends/family
- Zach manually tests all scenarios
- Monitor closely, fix bugs

### Beta Launch (Week 3-4)
- Add SMS number to website (small, low-visibility)
- Mention in confirmation emails: "You can also text us at..."
- Handle ~10-20 conversations/day
- Iterate on prompts based on real conversations

### Full Launch (Week 5+)
- Prominent SMS CTA on website
- Update Google My Business with SMS option
- Social media announcement
- Email existing customers
- Expect 50-100+ conversations/day

### Success Criteria
- < 10% escalation rate
- > 70% order completion rate
- < 5% error rate
- Positive customer feedback
- Reduces Zach's time on order intake by 50%+

---

## Support & Maintenance

### Ongoing Tasks
- Review conversation logs weekly
- Update system prompts based on common patterns
- Add new tools as business needs evolve
- Monitor costs and optimize if needed
- Review and approve special requests

### Prompt Tuning
- Collect examples of great conversations
- Collect examples of poor conversations
- Adjust system prompts monthly
- A/B test different response styles

### Database Maintenance
- Archive old conversations (>90 days)
- Clean up test data
- Optimize queries if performance degrades

---

## Resources

### Telnyx Documentation
- SMS API: https://developers.telnyx.com/docs/v2/messaging
- Webhooks: https://developers.telnyx.com/docs/v2/messaging/webhooks

### Anthropic Documentation
- Claude API: https://docs.anthropic.com/claude/reference/messages
- Tool Use: https://docs.anthropic.com/claude/docs/tool-use
- Prompt Engineering: https://docs.anthropic.com/claude/docs/prompt-engineering

### Additional Reading
- Conversational AI best practices
- SMS compliance (TCPA, A2P 10DLC registration)
- Customer service automation patterns

---

## Appendix: Example Conversation Flows

### Flow 1: Simple New Order

```
Customer: I need a pickup tomorrow

Agent: Absolutely! I can help you schedule that. What's your pickup address?

Customer: 456 Woodward Ave, 48226

Agent: Great, we service that area. Available time windows tomorrow:
• 10am-12pm
• 2-4pm
• 6-8pm
Which works better?

Customer: 2-4pm

Agent: Perfect. What type of service do you need?
• Wash & fold ($2.25/lb, $35 min)
• Dry cleaning
• Both

Customer: wash and fold

Agent: Got it. Any special instructions or requests?

Customer: nope

Agent: Perfect! I've scheduled your pickup:
📍 456 Woodward Ave, 48226
📅 Tomorrow, 2-4pm
👕 Wash & fold service

To confirm, I'll send a payment authorization link. You'll only be charged after we weigh your laundry. Sound good?

Customer: yes

Agent: [sends payment link]
Payment link sent! Once authorized, you're all set. We'll text 15 minutes before pickup. Thanks for choosing Bags of Laundry!
```

### Flow 2: Special Request with Approval

```
Customer: Can you pick up today? I'm leaving town tomorrow morning

Agent: I can check availability for today. What's your pickup address?

Customer: 789 Grand Blvd, 48202

Agent: We service that area. Our last available window today is 6-8pm. Does that work?

Customer: Yes but I really need it back by 7am tomorrow. Is that possible?

Agent: I've noted your urgent delivery request (need by 7am tomorrow). Zach will confirm we can accommodate this timeline and reach out if there are any questions. Let's continue with your order - what type of service?

[Conversation continues...]

[Meanwhile, Zach receives:]
"🔔 Special Request Approval

Customer: +17891234567
Request: Urgent delivery - pickup today 6-8pm, needs delivery by 7am tomorrow

Recent conversation:
👤: Can you pick up today? I'm leaving town tomorrow morning
🤖: I can check availability for today. What's your pickup address?
👤: 789 Grand Blvd, 48202
...

View: https://bagsoflaundry.com/admin/approvals/abc123"

[Zach approves and adds note: "Can do 7am delivery, add $20 rush fee"]

[Agent texts customer:]
Good news! Zach confirmed we can deliver by 7am tomorrow. There's a $20 rush fee for the expedited service. Your updated total authorization will be $55 minimum + $20 rush. Still work for you?
```

### Flow 3: Status Check

```
Customer: Where's my order?

Agent: Let me check on that for you!

[Agent looks up by phone number, finds active order]

Agent: Your order (#1234) is currently being processed at the laundromat. Estimated delivery tonight between 7-9pm to 456 Woodward Ave. I'll text when we're 15 minutes away!

Customer: Thanks

Agent: You're welcome! Anything else I can help with?
```

### Flow 4: Support Escalation

```
Customer: My clothes smell weird

Agent: I'm sorry to hear that - we want your laundry to be perfect. Can you describe the smell? Is it all items or specific pieces?

Customer: All of them, smells like mildew or something

Agent: I understand how frustrating that is. Let me connect you with Zach immediately so he can make this right. He'll reach out within a few minutes.

[Agent escalates, Zach gets notification]

[Zach replies from his phone:]
Hi, this is Zach. I'm so sorry about the odor issue. This isn't acceptable. I'd like to re-wash everything at no charge and deliver back to you tomorrow. Does that work? And I'll refund your full payment for the inconvenience.

Customer: That works, thank you

Zach: I'll pick them up within the hour. Again, my apologies - this should never happen.
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-17
**Owner:** Zach Lewis / Bags of Laundry
