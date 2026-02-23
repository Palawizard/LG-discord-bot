# Repository Guidelines

## Project Structure & Module Organization
This project is a Node.js Discord bot for a Werewolf-style game.

- `index.js`: runtime entrypoint; initializes the Discord client, loads slash commands, and handles interactions.
- `deploy-commands.js`: registers slash commands to a guild.
- `commands/`: one file per command (for example `startGame.js`, `endVote.js`). Each command should export `data` (`SlashCommandBuilder`) and `execute(interaction)`.
- `utils/`: shared helpers (for example `utils/votesStore.js` for vote state and locking).
- Root JSON files (`votes.json`, `roleAssignments.json`, `scoreboard.json`, etc.): persisted game state.
- `crashlogs/`: generated crash and rejection logs.

## Build, Test, and Development Commands
There is no build step; run directly with Node.js.

- `npm install`: install dependencies.
- `node deploy-commands.js`: publish/update slash commands for the configured guild.
- `node index.js`: start the bot locally.
- `npm test`: currently a placeholder and fails by design (`"no test specified"`).
- Windows helpers: `start.bat` and `deploy.bat` mirror the two Node commands above.

## Coding Style & Naming Conventions
- Use CommonJS modules (`require`, `module.exports`) to match the codebase.
- Prefer 4-space indentation, semicolons, and single quotes.
- Keep command handlers defensive: validate input/state early and return clear ephemeral error messages.
- File naming in `commands/` is mostly camelCase; slash command names should be lowercase (use hyphens only when needed, e.g. `move-all`).
- Keep shared state logic in `utils/` instead of duplicating read/write code across commands.

## Testing Guidelines
Automated tests are not configured yet. For changes, use a test guild and validate manually:

- command registration (`node deploy-commands.js`),
- command execution paths (success + invalid state),
- JSON persistence updates,
- crash behavior/log output in `crashlogs/`.

When adding tests, place them under `tests/` and use `*.test.js` naming.

## Commit & Pull Request Guidelines
Git history uses Conventional Commit style (`feat(scope): ...`, `fix(scope): ...`). Follow that pattern.

For pull requests:
- summarize gameplay/command behavior changes,
- link related issues,
- include manual test steps and results,
- call out any new/changed JSON state files or environment variables.

## Security & Configuration Tips
Never commit secrets. Keep tokens and IDs in `.env`; start from `.env.example` (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`).
