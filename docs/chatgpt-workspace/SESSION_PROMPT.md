# Reusable Implementation Session Prompt

Replace the placeholders and paste this into a new Project conversation.

---

Repository: `Blackleets/internet-brain-os`
Active Issue: `#<ISSUE_NUMBER> — <ISSUE_TITLE>`
Expected branch: `<BRANCH_NAME>`
Current phase: `<PHASE>`

Read the Project instructions, governance files, active Issue, current `main`, relevant source files, tests, and latest handoff before acting.

Your assignment:

`<EXACT_TASK>`

Hard boundaries:

- Do not expand beyond the active Issue.
- Do not modify protected files.
- Do not modify `packages/shared` unless the Issue explicitly authorizes a contract change.
- Do not add dependencies without justification.
- Do not start the next phase.
- Do not report validation unless it ran against the current commit.
- Keep institutional memory complete.

Required workflow:

1. Verify current GitHub state.
2. Report `APPROVED PLAN` or `CORRECTIONS REQUIRED` before implementation when design is unresolved.
3. Implement on the dedicated branch.
4. Add meaningful tests.
5. Run frozen install, typecheck, tests, and build.
6. Update changelog, handoff, Brain Log, and Knowledge Sync.
7. Open or update a draft PR.
8. Review actual CI and changed files.
9. Stop before merge unless explicit merge authorization is given.

Final report format:

- `STATUS`
- `BRANCH AND HEAD`
- `FILES CHANGED`
- `VALIDATION`
- `CI`
- `INSTITUTIONAL MEMORY`
- `RISKS`
- `SCOPE CONFIRMATION`
- `NEXT DECISION REQUIRED`

---
