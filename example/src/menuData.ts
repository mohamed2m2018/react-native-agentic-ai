// ─── Shared Menu Data ───────────────────────────────────────

export interface MenuItem {
  name: string;
  price: number;
  description: string;
  category: string;
  emoji: string;
  ingredients?: string;
}

export const MENUS: Record<string, MenuItem[]> = {
  Pizzas: [
    { name: 'Margherita', price: 10, description: 'Classic tomato & mozzarella', category: 'Pizzas', emoji: '🍕', ingredients: 'Tomato sauce, fresh mozzarella, basil' },
    { name: 'BBQ Chicken', price: 14, description: 'BBQ sauce, chicken & red onion', category: 'Pizzas', emoji: '🍕', ingredients: 'BBQ sauce, grilled chicken, red onion, cilantro' },
    { name: 'Veggie Supreme', price: 12, description: 'Bell peppers, mushrooms & olives', category: 'Pizzas', emoji: '🍕', ingredients: 'Bell peppers, mushrooms, olives, onions, tomato sauce' },
    { name: 'Pepperoni', price: 13, description: 'Classic pepperoni with extra cheese', category: 'Pizzas', emoji: '🍕', ingredients: 'Pepperoni, mozzarella, tomato sauce' },
    { name: 'Hawaiian', price: 12, description: 'Ham, pineapple & mozzarella', category: 'Pizzas', emoji: '🍕', ingredients: 'Ham, pineapple, mozzarella, tomato sauce' },
    { name: 'Four Cheese', price: 15, description: 'Mozzarella, cheddar, parmesan & gorgonzola', category: 'Pizzas', emoji: '🍕', ingredients: 'Mozzarella, cheddar, parmesan, gorgonzola' },
    { name: 'Meat Lovers', price: 16, description: 'Pepperoni, sausage, bacon & ham', category: 'Pizzas', emoji: '🍕', ingredients: 'Pepperoni, Italian sausage, bacon, ham' },
    { name: 'Spicy Diavola', price: 14, description: 'Spicy salami and chili flakes', category: 'Pizzas', emoji: '🍕', ingredients: 'Spicy salami, chili flakes, mozzarella, tomato sauce' },
    { name: 'Truffle Mushroom', price: 18, description: 'Wild mushrooms with truffle oil', category: 'Pizzas', emoji: '🍕', ingredients: 'Wild mushrooms, truffle oil, mozzarella, white sauce' },
    { name: 'Buffalo Chicken', price: 15, description: 'Spicy buffalo sauce and ranch', category: 'Pizzas', emoji: '🍕', ingredients: 'Buffalo sauce, chicken, mozzarella, ranch drizzle' },
  ],
  Burgers: [
    { name: 'Classic Smash', price: 11, description: 'Beef patty, lettuce & tomato', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, lettuce, tomato, pickles, special sauce' },
    { name: 'Cheese Burger', price: 13, description: 'Double cheese, pickles & onion', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, cheddar cheese x2, pickles, onion' },
    { name: 'Chicken Burger', price: 12, description: 'Crispy chicken with mayo', category: 'Burgers', emoji: '🍔', ingredients: 'Crispy chicken fillet, mayo, lettuce' },
    { name: 'Mushroom Swiss', price: 14, description: 'Sautéed mushrooms & Swiss cheese', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, sautéed mushrooms, Swiss cheese' },
    { name: 'Spicy Jalapeño', price: 13, description: 'Jalapeños, pepper jack & hot sauce', category: 'Burgers', emoji: '🌶️', ingredients: 'Beef patty, jalapeños, pepper jack cheese, hot sauce' },
    { name: 'Veggie Burger', price: 11, description: 'Plant-based patty with avocado', category: 'Burgers', emoji: '🥬', ingredients: 'Plant-based patty, avocado, lettuce, tomato' },
    { name: 'Bacon Blue', price: 15, description: 'Blue cheese and crispy bacon', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, blue cheese crumbles, bacon, caramelized onions' },
    { name: 'The Monster', price: 18, description: 'Triple patty loaded burger', category: 'Burgers', emoji: '🍔', ingredients: 'Three beef patties, bacon, egg, cheese, onion rings' },
  ],
  Drinks: [
    { name: 'Coke', price: 3, description: 'Coca-Cola 330ml', category: 'Drinks', emoji: '🥤' },
    { name: 'Lemonade', price: 4, description: 'Fresh squeezed lemonade', category: 'Drinks', emoji: '🍋' },
    { name: 'Water', price: 2, description: 'Still mineral water', category: 'Drinks', emoji: '💧' },
    { name: 'Iced Tea', price: 4, description: 'Peach iced tea', category: 'Drinks', emoji: '🧊' },
    { name: 'Orange Juice', price: 5, description: 'Fresh squeezed orange juice', category: 'Drinks', emoji: '🍊' },
    { name: 'Vanilla Shake', price: 6, description: 'Vanilla milkshake with whipped cream', category: 'Drinks', emoji: '🥛' },
    { name: 'Chocolate Shake', price: 6, description: 'Rich chocolate milkshake', category: 'Drinks', emoji: '🥛' },
    { name: 'Strawberry Shake', price: 6, description: 'Fresh strawberry milkshake', category: 'Drinks', emoji: '🍓' },
    { name: 'Sparkling Water', price: 3, description: 'Carbonated mineral water', category: 'Drinks', emoji: '🫧' },
  ],
  Desserts: [
    { name: 'Chocolate Cake', price: 7, description: 'Rich chocolate layer cake', category: 'Desserts', emoji: '🍰', ingredients: 'Dark chocolate, cream, flour, eggs' },
    { name: 'Cheesecake', price: 8, description: 'New York style cheesecake', category: 'Desserts', emoji: '🍰', ingredients: 'Cream cheese, graham crackers, vanilla' },
    { name: 'Ice Cream Trio', price: 5, description: 'Three scoops of your choice', category: 'Desserts', emoji: '🍦' },
    { name: 'Tiramisu', price: 9, description: 'Classic Italian tiramisu', category: 'Desserts', emoji: '☕', ingredients: 'Mascarpone, espresso, ladyfingers, cocoa' },
    { name: 'Apple Pie', price: 6, description: 'Warm apple pie with cinnamon', category: 'Desserts', emoji: '🥧', ingredients: 'Apples, cinnamon, pastry crust' },
    { name: 'Brownie Sundae', price: 8, description: 'Warm brownie with vanilla ice cream', category: 'Desserts', emoji: '🍨', ingredients: 'Fudge brownie, vanilla ice cream, hot fudge' },
  ],
  Salads: [
    { name: 'Caesar Salad', price: 9, description: 'Romaine, croutons, parmesan', category: 'Salads', emoji: '🥗', ingredients: 'Romaine lettuce, croutons, parmesan cheese, Caesar dressing' },
    { name: 'Greek Salad', price: 10, description: 'Feta, olives, cucumber, tomato', category: 'Salads', emoji: '🥗', ingredients: 'Feta cheese, kalamata olives, cucumber, tomatoes, red onion' },
    { name: 'Cobb Salad', price: 12, description: 'Chicken, bacon, egg, blue cheese', category: 'Salads', emoji: '🥗', ingredients: 'Grilled chicken, bacon, hard-boiled egg, blue cheese, avocado' },
    { name: 'Caprese', price: 11, description: 'Fresh mozzarella, tomatoes, basil', category: 'Salads', emoji: '🍅', ingredients: 'Fresh mozzarella, tomatoes, fresh basil, balsamic glaze' },
  ],
  Sushi: [
    { name: 'California Roll', price: 8, description: 'Crab, avocado, cucumber', category: 'Sushi', emoji: '🍣', ingredients: 'Imitation crab, avocado, cucumber, nori, rice' },
    { name: 'Spicy Tuna Roll', price: 9, description: 'Spicy tuna and cucumber', category: 'Sushi', emoji: '🍣', ingredients: 'Spicy tuna mix, cucumber, nori, rice' },
    { name: 'Dragon Roll', price: 14, description: 'Eel and cucumber topped with avocado', category: 'Sushi', emoji: '🐉', ingredients: 'Eel, cucumber, avocado, eel sauce' },
    { name: 'Salmon Sashimi', price: 12, description: '5 pieces of fresh salmon', category: 'Sushi', emoji: '🍱', ingredients: 'Fresh raw salmon' },
    { name: 'Rainbow Roll', price: 15, description: 'California roll topped with assorted fish', category: 'Sushi', emoji: '🍣', ingredients: 'Crab, avocado, tuna, salmon, yellowtail' },
  ],
  Breakfast: [
    { name: 'Pancakes', price: 8, description: 'Stack of 3 buttermilk pancakes', category: 'Breakfast', emoji: '🥞', ingredients: 'Flour, buttermilk, butter, maple syrup' },
    { name: 'Avocado Toast', price: 10, description: 'Smashed avocado on sourdough text', category: 'Breakfast', emoji: '🥑', ingredients: 'Sourdough bread, avocado, chili flakes, olive oil' },
    { name: 'Eggs Benedict', price: 12, description: 'Poached eggs on English muffin', category: 'Breakfast', emoji: '🍳', ingredients: 'English muffin, poached eggs, ham, hollandaise sauce' },
    { name: 'French Toast', price: 9, description: 'Brioche french toast with berries', category: 'Breakfast', emoji: '🍞', ingredients: 'Brioche bread, eggs, cinnamon, mixed berries' },
  ],
  Tacos: [
    { name: 'Al Pastor Taco', price: 4, description: 'Marinated pork with pineapple', category: 'Tacos', emoji: '🌮', ingredients: 'Marinated pork, pineapple, onions, cilantro, corn tortilla' },
    { name: 'Carne Asada Taco', price: 5, description: 'Grilled steak', category: 'Tacos', emoji: '🌮', ingredients: 'Grilled steak, onions, cilantro, corn tortilla' },
    { name: 'Fish Taco', price: 5, description: 'Battered fish with cabbage slaw', category: 'Tacos', emoji: '🐟', ingredients: 'White fish, batter, cabbage slaw, creamy sauce, flour tortilla' },
    { name: 'Chicken Tinga', price: 4, description: 'Shredded chicken in tomato chipotle sauce', category: 'Tacos', emoji: '🌮', ingredients: 'Shredded chicken, tomato, chipotle, onions, corn tortilla' },
  ],
};

// Flat list of all items for search
export const ALL_MENU_ITEMS: MenuItem[] = Object.values(MENUS).flat();

// Categories list
export const CATEGORIES = Object.keys(MENUS);
