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
    { name: 'BBQ Bacon', price: 14, description: 'BBQ sauce, bacon & cheddar', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, BBQ sauce, bacon, cheddar, onion rings' },
    { name: 'Truffle Burger', price: 19, description: 'Truffle aioli & gruyère', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, truffle aioli, gruyère cheese, arugula' },
    { name: 'Teriyaki Burger', price: 14, description: 'Teriyaki glaze & grilled pineapple', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, teriyaki sauce, grilled pineapple, lettuce' },
    { name: 'Guacamole Burger', price: 15, description: 'Fresh guacamole & pico de gallo', category: 'Burgers', emoji: '🥑', ingredients: 'Beef patty, guacamole, pico de gallo, pepper jack' },
    { name: 'Crispy Onion Burger', price: 13, description: 'Crispy fried onions & ranch', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, crispy onions, ranch dressing, lettuce' },
    { name: 'Peanut Butter Burger', price: 14, description: 'PB, bacon & jalapeños', category: 'Burgers', emoji: '🥜', ingredients: 'Beef patty, peanut butter, bacon, jalapeños' },
    { name: 'Greek Lamb Burger', price: 16, description: 'Lamb patty with tzatziki', category: 'Burgers', emoji: '🐑', ingredients: 'Lamb patty, tzatziki, feta, cucumber, tomato' },
    { name: 'Smokehouse Burger', price: 15, description: 'Smoked gouda & crispy onion', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, smoked gouda, crispy onions, chipotle mayo' },
    { name: 'Western Burger', price: 14, description: 'Onion rings & BBQ sauce', category: 'Burgers', emoji: '🤠', ingredients: 'Beef patty, onion rings, BBQ sauce, cheddar' },
    { name: 'Breakfast Burger', price: 13, description: 'Fried egg, bacon & hash brown', category: 'Burgers', emoji: '🍳', ingredients: 'Beef patty, fried egg, bacon, hash brown, American cheese' },
    { name: 'Portobello Burger', price: 12, description: 'Grilled portobello cap', category: 'Burgers', emoji: '🍄', ingredients: 'Portobello mushroom, roasted peppers, goat cheese, arugula' },
    { name: 'Bison Burger', price: 17, description: 'Lean bison patty with chipotle', category: 'Burgers', emoji: '🦬', ingredients: 'Bison patty, chipotle mayo, avocado, pepper jack' },
    { name: 'Fish Burger', price: 13, description: 'Battered cod with tartar sauce', category: 'Burgers', emoji: '🐟', ingredients: 'Battered cod fillet, tartar sauce, lettuce, pickles' },
    { name: 'Nashville Hot', price: 14, description: 'Nashville-style hot chicken', category: 'Burgers', emoji: '🔥', ingredients: 'Spicy fried chicken, pickles, coleslaw, hot sauce' },
    { name: 'Wagyu Burger', price: 22, description: 'Premium wagyu beef patty', category: 'Burgers', emoji: '🥩', ingredients: 'Wagyu beef patty, truffle butter, aged cheddar, caramelized onions' },
    { name: 'Cuban Burger', price: 14, description: 'Ham, pickles & Swiss cheese', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, ham, Swiss cheese, pickles, mustard' },
    { name: 'Tex-Mex Burger', price: 14, description: 'Chili, cheese & corn chips', category: 'Burgers', emoji: '🌮', ingredients: 'Beef patty, chili con carne, nacho cheese, corn chips' },
    { name: 'Mediterranean Burger', price: 15, description: 'Hummus, roasted peppers & feta', category: 'Burgers', emoji: '🫒', ingredients: 'Beef patty, hummus, roasted red peppers, feta, arugula' },
    { name: 'Korean BBQ Burger', price: 15, description: 'Gochujang glaze & kimchi', category: 'Burgers', emoji: '🇰🇷', ingredients: 'Beef patty, gochujang glaze, kimchi, sesame mayo' },
    { name: 'Pulled Pork Burger', price: 14, description: 'Slow-cooked pulled pork topping', category: 'Burgers', emoji: '🐷', ingredients: 'Beef patty, pulled pork, coleslaw, BBQ sauce' },
    { name: 'Caprese Burger', price: 14, description: 'Fresh mozzarella, tomato & basil', category: 'Burgers', emoji: '🍅', ingredients: 'Beef patty, fresh mozzarella, tomato, basil, balsamic' },
    { name: 'Philly Cheese Burger', price: 15, description: 'Philly cheesesteak style', category: 'Burgers', emoji: '🧀', ingredients: 'Beef patty, sliced steak, provolone, peppers, onions' },
    { name: 'Mac & Cheese Burger', price: 15, description: 'Topped with mac & cheese', category: 'Burgers', emoji: '🧀', ingredients: 'Beef patty, mac and cheese, bacon, jalapeños' },
    { name: 'Aloha Burger', price: 14, description: 'Grilled pineapple & teriyaki', category: 'Burgers', emoji: '🌺', ingredients: 'Beef patty, grilled pineapple, teriyaki sauce, Swiss cheese' },
    { name: 'Ranch Burger', price: 13, description: 'Buttermilk ranch & crispy bacon', category: 'Burgers', emoji: '🍔', ingredients: 'Beef patty, ranch dressing, bacon, lettuce, tomato' },
    { name: 'Buffalo Chicken Burger', price: 13, description: 'Buffalo sauce & blue cheese', category: 'Burgers', emoji: '🐔', ingredients: 'Crispy chicken, buffalo sauce, blue cheese crumbles, celery slaw' },
    { name: 'Elk Burger', price: 18, description: 'Wild elk with huckleberry jam', category: 'Burgers', emoji: '🦌', ingredients: 'Elk patty, huckleberry jam, brie cheese, arugula' },
    { name: 'Chipotle Black Bean', price: 12, description: 'Spiced black bean patty', category: 'Burgers', emoji: '🫘', ingredients: 'Black bean patty, chipotle mayo, avocado, pico de gallo' },
    { name: 'Double Down', price: 16, description: 'Double patty, double cheese', category: 'Burgers', emoji: '🍔', ingredients: 'Two beef patties, American cheese x2, pickles, special sauce' },
    { name: 'Steakhouse Burger', price: 17, description: 'Thick-cut steak burger with A1', category: 'Burgers', emoji: '🥩', ingredients: 'Thick steak patty, A1 sauce, crispy onions, provolone' },
    { name: 'PB&J Burger', price: 13, description: 'Peanut butter & strawberry jam', category: 'Burgers', emoji: '🍓', ingredients: 'Beef patty, peanut butter, strawberry jam, bacon' },
    { name: 'Cajun Burger', price: 14, description: 'Cajun spiced with rémoulade', category: 'Burgers', emoji: '🌶️', ingredients: 'Cajun-spiced beef patty, rémoulade sauce, fried green tomato' },
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
