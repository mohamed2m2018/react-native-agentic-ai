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
  ],
  Burgers: [
    { name: 'Classic Smash', price: 11, description: 'Beef patty, lettuce & tomato', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, lettuce, tomato, pickles, special sauce' },
    { name: 'Cheese Burger', price: 13, description: 'Double cheese, pickles & onion', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, cheddar cheese x2, pickles, onion' },
    { name: 'Chicken Burger', price: 12, description: 'Crispy chicken with mayo', category: 'Burgers', emoji: '🍔', ingredients: 'Crispy chicken fillet, mayo, lettuce' },
    { name: 'Mushroom Swiss', price: 14, description: 'Sautéed mushrooms & Swiss cheese', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, sautéed mushrooms, Swiss cheese' },
    { name: 'Spicy Jalapeño', price: 13, description: 'Jalapeños, pepper jack & hot sauce', category: 'Burgers', emoji: '🌶️', ingredients: 'Beef patty, jalapeños, pepper jack cheese, hot sauce' },
    { name: 'Veggie Burger', price: 11, description: 'Plant-based patty with avocado', category: 'Burgers', emoji: '🥬', ingredients: 'Plant-based patty, avocado, lettuce, tomato' },
  ],
  Drinks: [
    { name: 'Coke', price: 3, description: 'Coca-Cola 330ml', category: 'Drinks', emoji: '🥤' },
    { name: 'Lemonade', price: 4, description: 'Fresh squeezed lemonade', category: 'Drinks', emoji: '🍋' },
    { name: 'Water', price: 2, description: 'Still mineral water', category: 'Drinks', emoji: '💧' },
    { name: 'Iced Tea', price: 4, description: 'Peach iced tea', category: 'Drinks', emoji: '🧊' },
    { name: 'Orange Juice', price: 5, description: 'Fresh squeezed orange juice', category: 'Drinks', emoji: '🍊' },
    { name: 'Milkshake', price: 6, description: 'Vanilla milkshake with whipped cream', category: 'Drinks', emoji: '🥛' },
  ],
  Desserts: [
    { name: 'Chocolate Cake', price: 7, description: 'Rich chocolate layer cake', category: 'Desserts', emoji: '🍰', ingredients: 'Dark chocolate, cream, flour, eggs' },
    { name: 'Cheesecake', price: 8, description: 'New York style cheesecake', category: 'Desserts', emoji: '🍰', ingredients: 'Cream cheese, graham crackers, vanilla' },
    { name: 'Ice Cream', price: 5, description: 'Three scoops of your choice', category: 'Desserts', emoji: '🍦' },
    { name: 'Tiramisu', price: 9, description: 'Classic Italian tiramisu', category: 'Desserts', emoji: '☕', ingredients: 'Mascarpone, espresso, ladyfingers, cocoa' },
  ],
};

// Flat list of all items for search
export const ALL_MENU_ITEMS: MenuItem[] = Object.values(MENUS).flat();

// Categories list
export const CATEGORIES = Object.keys(MENUS);
