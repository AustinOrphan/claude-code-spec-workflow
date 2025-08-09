# Bug Report

## Bug Summary
Task command generation tests are checking for the wrong format - they expect the file-based command format in the content, but the system intentionally supports dual command formats: file-based (`/spec-name-task-id`) and content-based (`/Task:id-spec-name`).

## Bug Details

### Expected Behavior
The system should support two command formats:
1. **File-based**: `/user-auth-task-1` (derived from file location `.claude/commands/user-auth/task-1.md`)
2. **Content-based**: `/Task:1-user-auth` (documented in the file's Usage section as an alias)

Both formats should be documented in the generated command files for maximum flexibility.

### Actual Behavior  
- The implementation correctly generates `/Task:1-user-auth` format in the Usage section
- The file is correctly placed at `.claude/commands/{spec-name}/task-{id}.md` 
- Tests incorrectly expect the file-based format (`/user-auth-task-1`) to appear in the content
- Only one format is documented in the Usage section instead of both

### Steps to Reproduce
1. Run `npm test` or `npx jest tests/task-generator.test.ts`
2. Observe test failures in the "generateTaskCommand" describe block
3. Three tests fail with format mismatch errors

### Environment
- **Version**: 1.5.6 (local fork of claude-code-spec-workflow)
- **Platform**: Node.js 24.x on macOS
- **Configuration**: TypeScript 5.7.2, Jest 29.7.0

## Impact Assessment

### Severity
- [x] Medium - Feature impaired but workaround exists

### Affected Users
Developers running the test suite and users relying on the generated task command format. The actual task generation works, but the command format inconsistency could cause confusion.

### Affected Features
- Task command generation in spec workflow
- Auto-generated individual task commands
- Test suite integrity
- Documentation/examples that reference the command format

## Additional Context

### Error Messages
```
● Task Generator › generateTaskCommand › should generate command file with all sections

expect(received).toContain(expected) // indexOf

Expected substring: "/user-auth-task-1"
Received string: ... "/Task:1-user-auth" ...

at tests/task-generator.test.ts:300:23
```

Similar errors occur for tests at lines 329 and 352.

### Screenshots/Media
N/A

### Related Issues
- Similar to the createConfigFile method issue - implementation changed but tests weren't updated
- Part of broader test suite maintenance after format changes

## Initial Analysis

### Suspected Root Cause
The system was designed to support dual command formats, but:
1. Tests are checking for the wrong format in the content (they check for file-based format which comes from the file location, not content)
2. Only one format is documented in the Usage section
3. The "Next Steps" section correctly references the file-based format but doesn't mention the content-based alternative

The implementation at line 238 of `src/task-generator.ts` correctly generates the content-based format:
```typescript
content += `## Usage
\`\`\`
/Task:${task.id}-${specName}
\`\`\`
```

The file placement at `.claude/commands/{spec-name}/task-{id}.md` enables the file-based format.

### Affected Components
- `src/task-generator.ts` (line 238) - Should document both formats in Usage section
- `src/task-generator.ts` (line 275) - Should mention both formats in Next Steps
- `tests/task-generator.test.ts` (lines 300, 329, 352) - Should check for `/Task:` format or both formats
- Documentation - Should clarify the dual command system