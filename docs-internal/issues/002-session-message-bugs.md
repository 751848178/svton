# Issue 002: Session Message Persistence & Project Categorization Bugs

## Bug 1: AI Messages Lose Execution Order After Reload

**Status:** FIXED

**Root Cause:** `blocks` field (ContentBlock[]) was NOT serialized in `displayToStoredMessages()`. On reload, `storedToDisplayMessages()` could NOT reconstruct `blocks`. ChatMessage fell back to legacy grouped rendering (all thinking → all toolCalls → text).

**Fix:** Serialize `blocks` alongside existing fields in `displayToStoredMessages()`. On restore, reconstruct `blocks` from saved data in `storedToDisplayMessages()` with fallback reconstruction from `thinking`/`toolCalls` for legacy saved messages.

**Files:** `ai/agent-client/src/hooks/useSession.ts`

---

## Bug 2: New Chat Messages Bind to Wrong Session

**Status:** FIXED

**Root Cause:** `create()` had early-return when current session had no messages (`msgs.length === 0`), returning `activeSessionId.current` and reusing the empty session instead of creating a new one. When user later switched away, messages were saved under the reused session ID, appearing in the wrong session.

**Fix:** Removed the early-return. `create()` now always creates a fresh session. Added `isCreating` ref guard to prevent double-creation.

**Files:** `ai/agent-client/src/hooks/useSession.ts`

---

## Bug 3: AI Replies Lost on Reload (Messages Disappear)

**Status:** FIXED

**Root Cause:** **Synchronous observable notification race condition** in `ChatService.runAssistant()`.

In `chat.service.ts`, the completion sequence was:
```typescript
this.status = 'idle';                                                    // line 230
const duration = Date.now() - startedAt;
this.updateMessage(assistantMsg.id, { isStreaming: false, duration });   // line 233-234
```

The `@observable()` setter for `status` **synchronously** calls all subscribers (confirmed by `instance.ts:66-69`). The auto-save subscriber in `useSession.ts:112` runs immediately when `status` changes to `'idle'`:
```typescript
if (newStatus === 'idle' && prevStatus !== 'idle' && activeSessionId.current) {
    const snapshot = chatService.getMessagesForSave();  // runs BEFORE isStreaming is cleared
    saveSessionMessages(activeSessionId.current, snapshot);
}
```

At this point, `isStreaming` on the assistant message is **still `true`** (not yet cleared on line 234). `getMessagesForSave()` filters `!m.isStreaming`, so the **entire assistant reply is excluded** from the snapshot. Only the user message gets saved. On reload, the session appears empty or missing the AI reply.

The chain:
1. AI finishes → `this.status = 'idle'` → setter fires → `notify('status')` → synchronous subscriber call
2. Subscriber calls `getMessagesForSave()` → assistant message still has `isStreaming: true` → **filtered out**
3. `saveSessionMessages()` only saves the user message
4. `isStreaming: false` is set AFTER the subscriber already ran → too late

**Fix:** Reorder — set `isStreaming: false` on the assistant message BEFORE setting `status = 'idle'`. This ensures the snapshot captured by the subscriber includes the complete assistant reply.

**Files:** `ai/agent-client/src/service/chat.service.ts` (lines 230-235)

---

## Bug 4: New Conversation Not Categorized Under Selected Project

**Status:** FIXED

**Root Cause:** `saveSession()` in `SessionService` mapped sessions for the list update but only copied `title`, `messageCount`, `updatedAt` — it did NOT include `projectId`. So even though `updateProjectId()` correctly set `projectId` on the session list, the next `saveSession()` call (auto-save after message) would overwrite the list with a mapping that **dropped** `projectId`.

Additionally, Bug 3 (messages lost) caused the first auto-save to have wrong `messageCount` (only 1 user message instead of 2 messages), which further confused categorization.

The chain:
1. User selects project → `updateProjectId()` sets `projectId` on session list ✓
2. User sends message → auto-save → `saveSessionMessages()` → `saveSession()`
3. `saveSession()` does `sessions.map(s => s.id === data.id ? { ...s, title, messageCount, updatedAt } : s)` — **no projectId**
4. `this.sessions = updatedSessions` overwrites the list, **losing the projectId**

**Fix:** Added `projectId: data.projectId` to the session list mapping in `saveSession()`. Combined with Bug 3 fix (messages no longer lost), categorization now works correctly.

**Files:** `ai/agent-client/src/service/session.service.ts` (line 122)

---

## Bug 5: Working Directory Not Updated for New Conversations

**Status:** FIXED

**Root Cause:** `ChatService.init()` had a guard `if (this.runtime && this.currentModel === config.model) return;`. When user switched projects (which triggers `onReinit` → `initAgent` → new config), the model stayed the same, so `chatService.init()` **skipped re-initialization**. The runtime kept using the old `workingDir`.

The chain:
1. User selects project → `handleSwitchProject()` → `onReinit(newDir)` → `initAgent()`
2. `initAgent()` reads new workingDir from storage, creates new config with correct workingDir
3. `setAgentConfig()` → AgentProvider re-renders → `chatService.init(platform, config)` called
4. Guard check: `this.currentModel === config.model` → true → **early return, runtime NOT recreated**
5. Old runtime still has old workingDir → file operations use wrong directory

**Fix:** Added `runtimeWorkingDir` tracking to `ChatService`. The init guard now checks `this.currentModel === config.model && this.runtimeWorkingDir === config.workingDir`. When workingDir changes (project switch), the runtime is properly recreated with the new working directory.

**Files:** `ai/agent-client/src/service/chat.service.ts` (lines 31, 57-58, 88)
