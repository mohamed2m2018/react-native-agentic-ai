import { actionRegistry } from '../core/ActionRegistry';
import { dataRegistry } from '../core/DataRegistry';
import { act } from '@testing-library/react-native';

// Global test setup and teardown

afterEach(async () => {
  // Clear the global ActionRegistry singleton after every test
  // to ensure test isolation. Otherwise, useAction() registrations
  // will bleed across tests and pollute the MCP server tools list.
  await act(async () => {
    actionRegistry.clear();
    dataRegistry.clear();
  });
});
