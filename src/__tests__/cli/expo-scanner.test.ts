import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { scanExpoRouterApp } from '../../cli/scanners/expo-scanner';

function createProject(files: Record<string, string>): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-scanner-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents);
  }
  return projectRoot;
}

function getScreen(projectRoot: string, routeName: string) {
  const screen = scanExpoRouterApp(projectRoot).find(candidate => candidate.routeName === routeName);
  expect(screen).toBeDefined();
  return screen!;
}

describe('Expo scanner', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves imported named screen wrappers and extracts real content', () => {
    const projectRoot = createProject({
      'app/add-transaction.tsx': `
        import { AddTransactionScreen } from '../src/screens/add-transaction';
        export default AddTransactionScreen;
      `,
      'src/screens/add-transaction.tsx': `
        import { Pressable, Text, View } from 'react-native';
        export function AddTransactionScreen() {
          return <View><Text>Add transaction</Text><Pressable><Text>Save transaction</Text></Pressable></View>;
        }
      `,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'add-transaction');

    expect(screen.description).toContain('Save transaction');
    expect(screen.description).not.toBe('Screen content');
  });

  it('resolves export-default proxy routes', () => {
    const projectRoot = createProject({
      'app/paywall.tsx': `export { default } from '../src/screens/paywall';`,
      'src/screens/paywall.tsx': `
        import { Text, View } from 'react-native';
        export default function PaywallScreen() {
          return <View><Text>Upgrade to Pro</Text></View>;
        }
      `,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'paywall');

    expect(screen.description).toContain('Upgrade to Pro');
  });

  it('resolves export-named-as-default through barrel hops', () => {
    const projectRoot = createProject({
      'app/add-transaction.tsx': `export { AddTransactionScreen as default } from '../src/screens';`,
      'src/screens/index.ts': `export { AddTransactionScreen } from './add-transaction';`,
      'src/screens/add-transaction.tsx': `
        import { Text, View } from 'react-native';
        export function AddTransactionScreen() {
          return <View><Text>Add transaction</Text><Text>Amount</Text></View>;
        }
      `,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'add-transaction');

    expect(screen.description).toContain('Add transaction');
    expect(screen.description).toContain('Amount');
  });

  it('resolves tsconfig path aliases for wrapper routes', () => {
    const projectRoot = createProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          paths: {
            '@/*': ['./*'],
          },
        },
      }),
      'app/index.tsx': `export { default } from '@/src/screens/home';`,
      'src/screens/home.tsx': `
        import { Text, View } from 'react-native';
        export default function HomeScreen() {
          return <View><Text>Welcome home</Text></View>;
        }
      `,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'index');

    expect(screen.description).toContain('Welcome home');
  });

  it('resolves base-url style src imports without explicit tsconfig aliases', () => {
    const projectRoot = createProject({
      'app/settings.tsx': `export { default } from 'src/screens/settings';`,
      'src/screens/settings.tsx': `
        import { Text, View } from 'react-native';
        export default function SettingsScreen() {
          return <View><Text>Notification preferences</Text></View>;
        }
      `,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'settings');

    expect(screen.description).toContain('Notification preferences');
  });

  it('keeps real route-file JSX when the route file already has strong content', () => {
    const projectRoot = createProject({
      'app/index.tsx': `
        import LegacyHome from '../src/screens/legacy-home';
        import { Text, View } from 'react-native';
        export default function HomeScreen() {
          return <View><Text>New dashboard</Text></View>;
        }
      `,
      'src/screens/legacy-home.tsx': `
        import { Text, View } from 'react-native';
        export default function LegacyHome() {
          return <View><Text>Legacy dashboard</Text></View>;
        }
      `,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'index');

    expect(screen.description).toContain('New dashboard');
    expect(screen.description).not.toContain('Legacy dashboard');
  });

  it('pulls navigation links from the resolved implementation file', () => {
    const projectRoot = createProject({
      'app/index.tsx': `export { default } from '../src/screens/home';`,
      'src/screens/home.tsx': `
        import { Link } from 'expo-router';
        import { Text, View } from 'react-native';
        export default function HomeScreen() {
          return <View><Link href="/details"><Text>Open details</Text></Link></View>;
        }
      `,
      'app/details.tsx': `
        import { Text, View } from 'react-native';
        export default function DetailsScreen() {
          return <View><Text>Details</Text></View>;
        }
      `,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'index');

    expect(screen.navigationLinks).toContain('/details');
  });

  it('falls back safely when a proxy chain exceeds the hop limit', () => {
    const files: Record<string, string> = {
      'app/index.tsx': `export { default } from '../src/chain/step-0';`,
    };
    for (let index = 0; index < 11; index++) {
      const nextPath = index === 10 ? './final-screen' : `./step-${index + 1}`;
      files[`src/chain/step-${index}.tsx`] = `export { default } from '${nextPath}';`;
    }
    files['src/chain/final-screen.tsx'] = `
      import { Text, View } from 'react-native';
      export default function FinalScreen() {
        return <View><Text>Resolved too deep</Text></View>;
      }
    `;

    const projectRoot = createProject(files);
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'index');

    expect(screen.description).toBe('Screen content');
  });

  it('falls back safely when a proxy chain contains a cycle', () => {
    const projectRoot = createProject({
      'app/index.tsx': `export { default } from '../src/cycle/a';`,
      'src/cycle/a.tsx': `export { default } from './b';`,
      'src/cycle/b.tsx': `export { default } from './a';`,
    });
    tempDirs.push(projectRoot);

    const screen = getScreen(projectRoot, 'index');

    expect(screen.description).toBe('Screen content');
  });
});
