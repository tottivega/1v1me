REPO SAFETY
[ ] git required
[ ] commit after each task
[ ] no force push
[ ] no rm -rf

CONTEXT FILES
[ ] ARCHITECTURE.md
[ ] DESIGN.md
[ ] RULES.md
[ ] README.md

TASK RULES
[ ] plan before code, read TODO and PROGRESS
[ ] one task = one commit
[ ] update TODO at the end
[ ] update PROGRESS at the end

EDIT RULES
[ ] minimal edits
[ ] no mass refactor
[ ] no delete without reason

ARCHITECTURE LOCK
[ ] no structure change without approval
[ ] no dependency change without approval
[ ] no framework change without approval

TESTING
[ ] tests before
[ ] tests after
[ ] block commit if failing

LINTING
[ ] fix errors before committing
[ ] warnings require judgment: if the pattern is intentional (e.g. narrowed dep array), add eslint-disable-next-line with a comment if the reason isn't obvious; if the pattern is a real bug or bad code, fix the code instead — never mass-suppress warnings without reading them

DEPENDENCIES
[ ] lockfile required
[ ] no new deps without approval

DANGEROUS COMMANDS
[ ] block rm -rf
[ ] block reset hard
[ ] block clean
[ ] block sudo