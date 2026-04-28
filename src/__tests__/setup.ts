import { actionRegistry } from '../core/ActionRegistry';
import { dataRegistry } from '../core/DataRegistry';

// Global test setup and teardown

afterEach(() => {
  // Clear the global ActionRegistry singleton after every test
  // to ensure test isolation. Otherwise, useAction() registrations
  // will bleed across tests and pollute the MCP server tools list.
  actionRegistry.clear();
  dataRegistry.clear();
});
