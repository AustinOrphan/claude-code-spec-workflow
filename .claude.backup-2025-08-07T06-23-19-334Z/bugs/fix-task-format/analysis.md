# Bug Analysis - Task Command Format Dual System

## Root Cause Investigation

### Historical Context
The task command format was changed on August 5, 2025 (commit `209d1b98`) as part of a "fresh installation update process". The change was:
- **From**: `/${specName}-task-${task.id}` 
- **To**: `/Task:${task.id}-${specName}`

This was later refined in commit `16280ef` to support "**Task X.X.X**: format" for better parsing.

### The Dual Command System Design

After deep investigation, the system appears to support **two distinct command invocation methods**:

1. **File-based commands** (Implicit from file location)
   - Files are created at: `.claude/commands/{spec-name}/task-{id}.md`
   - Claude Code would interpret these as: `/{spec-name}-task-{id}`
   - This is the "natural" command name based on file location

2. **Content-based commands** (Explicit in file content)
   - The file content includes: `/Task:{id}-{spec-name}` in the Usage section
   - This serves as an alias or alternative invocation method
   - This format is more structured and easier to parse programmatically

### Verification of Dual System

**Evidence the dual system is intentional:**
1. Files are deliberately placed in spec-specific subdirectories
2. The content deliberately uses a different format
3. CLI output (src/cli.ts lines 301, 315-317) displays the file-based format
4. The "Next Steps" section references the file-based format
5. The Usage section shows the content-based format

**However, there's inconsistency:**
- The CLI displays `/{specName}-task-${task.id}` when commands are generated
- But the file content shows `/Task:${task.id}-${specName}`
- Users are not informed that both formats work

## Code Analysis

### Locations Requiring Updates

1. **src/task-generator.ts**
   - Line 238: Currently shows only `/Task:` format in Usage
   - Line 275: References only file-based format in Next Steps
   - **Fix**: Document both formats in both sections

2. **src/cli.ts**
   - Lines 301, 315-317: Display file-based format after generation
   - **Fix**: Also mention the `/Task:` alternative format

3. **tests/task-generator.test.ts**
   - Lines 300, 329, 352: Expect file-based format in content
   - **Fix**: Check for `/Task:` format or update to check for both

4. **src/markdown/commands/spec-create.md**
   - Line 357: References file-based format
   - **Fix**: Document both formats

## Impact Analysis

### Current User Experience
Users see mixed messages:
1. After generating tasks, CLI shows: `/{spec-name}-task-{id}`
2. Opening the command file shows: `/Task:{id}-{spec-name}`
3. Documentation references both formats inconsistently

### Potential Confusion Points
- Users might not realize both formats work
- Tests fail because they check for the wrong format
- Documentation doesn't explain the dual system

## Solution Options

### Option 1: Document Both Formats (Recommended)
**Approach**: Explicitly document both command formats in generated files

**Implementation**:
```markdown
## Usage
You can invoke this task using either format:
```
/{spec-name}-task-{id}
/Task:{id}-{spec-name}
```
```

**Pros**:
- Maximum flexibility for users
- Clarifies the dual system
- Maintains backward compatibility

**Cons**:
- Slightly more complex documentation

### Option 2: Standardize on One Format
**Approach**: Pick one format and use it consistently everywhere

**Pros**:
- Simpler, more consistent
- Less user confusion

**Cons**:
- Breaking change for existing users
- Loses flexibility of dual system

### Option 3: Fix Tests Only
**Approach**: Update tests to check for `/Task:` format, leave implementation as-is

**Pros**:
- Minimal changes
- Tests pass

**Cons**:
- Doesn't address user confusion
- Inconsistency remains

## Recommended Solution: Option 1 - Document Both Formats

### Implementation Plan

1. **Update task-generator.ts**:
   - Modify Usage section to show both formats
   - Update Next Steps to mention both formats
   - Add comment explaining the dual system

2. **Update tests**:
   - Check for `/Task:` format (what's actually in content)
   - Optionally add test that both formats are documented

3. **Update CLI output**:
   - When displaying generated commands, mention both formats
   - Add note that either format works

4. **Update documentation**:
   - spec-create.md should explain both formats
   - README should mention the dual command system

### Code Changes Required

#### src/task-generator.ts (Line 236-240)
```typescript
content += `## Usage
You can invoke this task using either format:
\`\`\`
/${specName}-task-${task.id}
/Task:${task.id}-${specName}
\`\`\`

Both commands will execute the same task.
`
```

#### src/task-generator.ts (Line 273-276)
```typescript
## Next Steps
After task completion, you can:
- Execute the next task using either:
  - /${specName}-task-[next-id]
  - /Task:[next-id]-${specName}
- Check overall progress with /spec-status ${specName}
```

#### tests/task-generator.test.ts
Update tests to check for `/Task:` format or both formats:
```typescript
// Check both formats are documented
expect(content).toContain('/Task:1-user-auth');
expect(content).toContain('/user-auth-task-1');
```

## Technical Details

### How Claude Code Interprets Commands
Claude Code appears to support:
1. **Direct file matching**: Commands in `.claude/commands/` directory
2. **Subdirectory matching**: Commands in `.claude/commands/{subdir}/`
3. **Content-based commands**: Commands documented within files

The dual system leverages both file location and content documentation.

### Why The Dual System Makes Sense
1. **File-based**: Natural, intuitive, follows directory structure
2. **Content-based**: Structured, parseable, consistent format

Having both provides flexibility and backwards compatibility.

## Prevention Recommendations

1. **Clear Documentation**: Always document when multiple invocation methods exist
2. **Consistent Testing**: Tests should verify what's actually generated, not assumed formats
3. **User Communication**: Make dual systems explicit in CLI output
4. **Validation**: Add tests that verify both formats work in practice

## Conclusion

The dual command format system is intentional but poorly documented. The fix should:
1. Explicitly document both formats in generated files
2. Update tests to check for correct content
3. Inform users that both formats are available
4. Maintain consistency across all documentation

This will eliminate confusion while preserving the flexibility of the dual system.