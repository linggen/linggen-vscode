# Contributing to Linggen VS Code Extension

Thank you for your interest in contributing to the Linggen VS Code extension!

## Development Setup

1. **Clone the repository** and navigate to the project folder
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Compile the TypeScript code**:
   ```bash
   npm run compile
   ```

## Development Workflow

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch a new VS Code window with the extension loaded
3. Test the commands from the Command Palette (Cmd/Ctrl+Shift+P)

### Making Changes

1. Edit TypeScript files in the `src/` directory
2. Run `npm run compile` or `npm run watch` (for auto-compilation)
3. Reload the extension host window (Cmd/Ctrl+R in the extension development host)

### Testing

Run the test suite:

```bash
npm test
```

### Linting

Check for code style issues:

```bash
npm run lint
```

## Project Structure

```
linggen-vscode/
├── src/
│   ├── extension.ts          # Main extension entry point
│   └── test/
│       ├── runTest.ts         # Test runner
│       └── suite/
│           ├── index.ts       # Test suite setup
│           └── extension.test.ts  # Extension tests
├── package.json               # Extension manifest and dependencies
├── tsconfig.json             # TypeScript configuration
├── README.md                 # User documentation
└── CHANGELOG.md              # Version history
```

## Adding New Commands

1. **Register the command** in `package.json` under `contributes.commands`:
   ```json
   {
     "command": "linggen.myNewCommand",
     "title": "Linggen: My New Command"
   }
   ```

2. **Implement the command** in `src/extension.ts`:
   ```typescript
   async function myNewCommand() {
     // Implementation here
   }
   ```

3. **Wire it up** in the `activate` function:
   ```typescript
   context.subscriptions.push(
     vscode.commands.registerCommand('linggen.myNewCommand', myNewCommand)
   );
   ```

4. **Add tests** in `src/test/suite/extension.test.ts`

## Code Style

- Use TypeScript strict mode
- Follow the ESLint configuration
- Use async/await for asynchronous operations
- Log to the output channel for debugging
- Show user-friendly error messages via `vscode.window.showErrorMessage`

## Submitting Changes

1. Create a new branch for your feature/fix
2. Make your changes with clear commit messages
3. Test thoroughly
4. Update CHANGELOG.md
5. Submit a pull request

## Questions?

If you have questions or need help, please open an issue on the repository.

