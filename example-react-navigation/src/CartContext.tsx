import { createContext, useContext, useState, type ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────

export interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

interface CartContextValue {
  cart: CartItem[];
  addToCart: (name: string, price: number, quantity: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

// ─── Context ────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (name: string, price: number, quantity: number) => {
    setCart(prev => {
      // If item already exists, increment quantity
      const existing = prev.findIndex(i => i.name === name);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing]!, quantity: updated[existing]!.quantity + quantity };
        return updated;
      }
      return [...prev, { name, price, quantity }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => setCart([]);

  const getTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, getTotal }}>
      {children}
    </CartContext.Provider>
  );
}
