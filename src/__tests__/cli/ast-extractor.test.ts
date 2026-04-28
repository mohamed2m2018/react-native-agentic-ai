import { buildDescription, extractContentFromAST } from '../../cli/extractors/ast-extractor';

describe('AST extractor', () => {
  it('resolves human-facing labels from nested mapped JSX without falling back to generic property names', () => {
    const source = `
      const shortcuts = [
        { title: 'Orders & delivery', subtitle: 'Track and update your order', route: 'OrdersList' },
        { title: 'Subscriptions', subtitle: 'Manage your meal plan', route: 'SubscriptionManagement' },
        { title: 'Billing history', subtitle: 'See past invoices', route: 'BillingHistory' },
      ];

      export function ProfileScreen() {
        return (
          <ScrollView>
            {shortcuts.map((shortcut) => (
              <Pressable key={shortcut.title} onPress={() => navigation.navigate(shortcut.route)}>
                <View>
                  <Text>{shortcut.title}</Text>
                  <Text>{shortcut.subtitle}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        );
      }
    `;

    const extracted = extractContentFromAST(source, '/tmp/ProfileScreen.tsx');

    expect(extracted.elements).toContain('Orders & delivery (button)');
    expect(extracted.elements).toContain('Subscriptions (button)');
    expect(extracted.elements).toContain('Billing history (button)');
    expect(extracted.elements).not.toContain('title (button)');
    expect(extracted.elements).not.toContain('subtitle (button)');
    expect(extracted.navigationLinks).toContain('SubscriptionManagement');
  });

  it('prefers nested visible text over wrapper component names in descriptions', () => {
    const source = `
      const sections = [{ heading: 'Pause subscription' }];

      export function SubscriptionScreen() {
        return (
          <View>
            {sections.map((section) => (
              <ActionCard key={section.heading}>
                <ActionRow>
                  <Text>{section.heading}</Text>
                </ActionRow>
              </ActionCard>
            ))}
          </View>
        );
      }
    `;

    const extracted = extractContentFromAST(source, '/tmp/SubscriptionScreen.tsx');
    const description = buildDescription(extracted);

    expect(description).toContain('Pause subscription');
    expect(description).not.toContain('heading (button)');
    expect(description).not.toContain('ActionCard (component)');
  });

  it('prefers product names over punctuation-only price template fragments', () => {
    const source = `
      const products = [{ id: '1', name: 'Wireless Headphones', price: 79.99 }];

      export function HomeScreen() {
        return (
          <View>
            {products.map((product) => (
              <Pressable key={product.id} onPress={() => {}}>
                <Text>{product.name}</Text>
                <Text>{'$'}{product.price}</Text>
              </Pressable>
            ))}
          </View>
        );
      }
    `;

    const extracted = extractContentFromAST(source, '/tmp/HomeScreen.tsx');

    expect(extracted.elements).toContain('Wireless Headphones (button)');
    expect(extracted.elements).not.toContain('$ (button)');
  });

  it('uses visible text as a fallback summary for non-interactive screens', () => {
    const source = `
      export function AboutScreen() {
        return (
          <ScrollView>
            <Text>About ShopApp</Text>
            <Text>Version 1.0.0</Text>
            <Text>Expo Router integration demo</Text>
            <Text>Technologies</Text>
          </ScrollView>
        );
      }
    `;

    const extracted = extractContentFromAST(source, '/tmp/AboutScreen.tsx');
    const description = buildDescription(extracted);

    expect(description).toContain('About ShopApp');
    expect(description).not.toBe('Screen content');
  });

  it('extracts mapped pressable option labels from local arrays', () => {
    const source = `
      const LANGUAGES = ['English', 'Arabic', 'Spanish'];

      export function LanguageScreen() {
        return (
          <View>
            {LANGUAGES.map((lang) => (
              <Pressable key={lang} onPress={() => setSelected(lang)}>
                <Text>{lang}</Text>
              </Pressable>
            ))}
          </View>
        );
      }
    `;

    const extracted = extractContentFromAST(source, '/tmp/LanguageScreen.tsx');

    expect(extracted.elements).toContain('English (button)');
    expect(extracted.elements).toContain('Arabic (button)');
    expect(extracted.elements).toContain('Spanish (button)');
  });

  it('describes API-backed style lists with structural hints when item labels are unknown', () => {
    const source = `
      export function HomeScreen() {
        return (
          <FlatList
            data={products}
            renderItem={({ item }) => (
              <Pressable onPress={() => navigation.navigate('product/[id]')}>
                <Text>{item.displayName}</Text>
                <Text>{'$'}{item.price}</Text>
              </Pressable>
            )}
          />
        );
      }
    `;

    const extracted = extractContentFromAST(source, '/tmp/FlatListScreen.tsx');
    const description = buildDescription(extracted);

    expect(description).toContain('scrollable list');
    expect(description).toContain('list with selectable rows');
    expect(description).toContain('rows navigate to product/[id]');
  });

  it('prefers durable renderItem structure over transient loading or empty-state copy', () => {
    const source = `
      export function SearchScreen() {
        return (
          <View>
            {isLoading ? <ActivityIndicator /> : null}
            {products.length === 0 ? <Text>No products found</Text> : null}
            <FlatList
              data={products}
              renderItem={({ item }) => (
                <Pressable onPress={() => navigation.navigate('ProductDetails')}>
                  <Image source={{ uri: item.image }} />
                  <Text>{item.name}</Text>
                  <Text>{'$'}{item.price}</Text>
                  <Button title="Add" onPress={() => addToCart(item)} />
                </Pressable>
              )}
            />
          </View>
        );
      }
    `;

    const extracted = extractContentFromAST(source, '/tmp/SearchScreen.tsx');
    const description = buildDescription(extracted);

    expect(description).toContain('scrollable list with selectable rows');
    expect(description).toContain('product image');
    expect(description).toContain('product name');
    expect(description).toContain('price');
    expect(description).toContain('add button');
    expect(description).toContain('rows navigate to ProductDetails');
    expect(description).not.toContain('ActivityIndicator');
    expect(description).not.toContain('No products found');
  });
});
