# Skill: Verify Before Done

## Trigger
When completing any code change, bug fix, or feature implementation.

## Rules

### 1. Trace the full data flow
After making changes, mentally trace the complete execution path:
- Input → Processing → Output → Side Effects
- Check every branch: success path, error path, edge cases
- Verify state transitions are correct at each step

### 2. Check timing and async
- Observable setters fire synchronously — verify subscriber execution order
- Async operations may interleave — check for race conditions
- Cleanup/teardown must cancel pending operations

### 3. Verify edge cases
- Streaming state during session switching
- Empty state (no messages, no sessions)
- Concurrent operations (rapid clicking, double-submit)
- Persistence: save → close → reopen → load

### 4. Do not stop until verified
If verification reveals a problem:
1. Diagnose root cause (read code, trace flow)
2. Fix the specific issue
3. Re-verify the full flow
4. Repeat until all paths are confirmed correct

### 5. Research before implementing
When unsure about expected UX behavior:
- Research how similar products handle the interaction (Claude Code, Cursor, ChatGPT)
- Understand the convention before writing code
- Do not guess — research first

## Anti-patterns to avoid
- Marking a task done after making changes without verification
- Assuming a fix works because "the logic looks right"
- Skipping edge case analysis because "it's unlikely"
- Implementing without understanding the expected UX
