# Universal Craft Principles Examples

## 1. Split a giant handler into a dispatcher shell plus handlers

When one function both decides the type and performs the work, stop enlarging the switch.

```ts
// Before
export async function runJob(job: Job) {
  switch (job.type) {
    case 'email':
      await sendEmail(job.payload);
      await saveAudit(job.id, 'email');
      return;
    case 'sms':
      await sendSms(job.payload);
      await saveAudit(job.id, 'sms');
      return;
    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}
```

```ts
// After
type JobHandler = (job: Job) => Promise<void>;

const handlers: Record<Job['type'], JobHandler> = {
  email: runEmailJob,
  sms: runSmsJob,
};

export async function runJob(job: Job) {
  const handler = handlers[job.type];
  if (!handler) throw new Error(`Unsupported job type: ${job.type}`);
  await handler(job);
}
```

The entry point dispatches. Each handler owns its execution details.

Avoid stopping at `switch` extraction where the same module still chooses the type, performs the work, writes shared side effects, and owns recovery. Smaller branches do not automatically create clearer ownership.

## 2. Pull fallback strategy back into the service

Call sites should ask for a business result, not know which provider to try first.

```ts
// Before
export async function getAvatar(userId: string) {
  try {
    return await primaryAvatarClient.fetch(userId);
  } catch {
    return backupAvatarClient.fetch(userId);
  }
}

const avatar = await getAvatar(user.id);
```

```ts
// After
const avatar = await avatarService.getAvatar(user.id);

class AvatarService {
  async getAvatar(userId: string) {
    try {
      return await primaryAvatarClient.fetch(userId);
    } catch {
      return backupAvatarClient.fetch(userId);
    }
  }
}
```

The caller now depends on one stable contract instead of provider policy.

Avoid wrapping provider selection in a thin utility when callers still decide when to use primary, backup, or cached data. If the call site still knows the policy, the service boundary has not actually improved.

## 3. Represent multi-step async work as steps

If transport, retries, and task-specific logic are interleaved, make the flow explicit.

```ts
// Before
export async function syncOrder(orderId: string) {
  const order = await orderRepo.get(orderId);
  const payload = toPartnerPayload(order);
  const response = await partnerClient.push(payload);
  await auditRepo.save({ orderId, response });
  await orderRepo.markSynced(orderId, response.partnerId);
}
```

```ts
// After
const syncOrderSteps = [
  loadOrder,
  buildPartnerPayload,
  pushToPartner,
  persistSyncResult,
];

export async function syncOrder(orderId: string) {
  return runSteps({ orderId }, syncOrderSteps);
}
```

The step runner owns sequencing. Each step owns one transformation or side effect.

## 4. Replace drifting business facts with one source of truth

If several fields restate the same fact, remove the shadows and derive the read model.

```ts
// Before
type TicketRecord = {
  status: 'open' | 'closed';
  displayStatus: string;
  resolvedStatus: 'pending' | 'done';
};
```

```ts
// After
type TicketRecord = {
  status: 'open' | 'closed';
};

function toTicketView(ticket: TicketRecord) {
  return {
    status: ticket.status,
    displayStatus: ticket.status === 'open' ? 'Pending' : 'Done',
    resolvedStatus: ticket.status === 'open' ? 'pending' : 'done',
  };
}
```

Persist the real fact once. Assemble presentation-oriented fields where they are needed.
