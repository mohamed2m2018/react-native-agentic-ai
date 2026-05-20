---
description: Rules for safely removing or deleting code files from the project
---

# Safe Code Removal Workflow

## ABSOLUTE RULE: NEVER delete files without a full import scan first.

### Before deleting ANY file:

1. **Run a grep search** for the filename (without extension) across the ENTIRE `src/` directory to find all imports:
   ```bash
   grep -r "filename" src/ --include="*.ts" --include="*.tsx"
   ```

2. **Check `index.ts` exports** — is this file exported to consumers?

3. **Check the example app** — is anything in `example/` importing or using this file?

4. **List every file that references it** and verify each reference will be updated or is already dead.

5. **Only after confirming ZERO live references**, propose the deletion to the user with the full list of evidence.

### NEVER do:
- Delete files in bulk without scanning each one individually
- Assume a file is "outdated" based on a plan — verify with actual import analysis
- Delete infrastructure files (registries, managers, singletons) without checking runtime usage
- Delete AND modify in the same step — scan first, propose second, execute third

### If you accidentally delete a file:
- Check `git status` immediately
- If tracked by git: `git checkout -- path/to/file`
- If untracked (new file): you MUST recreate it from the last viewed version
- ALWAYS verify the build compiles after restoring
