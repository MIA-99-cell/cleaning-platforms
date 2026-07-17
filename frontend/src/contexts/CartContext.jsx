import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CART_KEY = 'cleanpro_marketplace_cart';

const CartContext = createContext(null);

const readCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (
          i.id === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        ));
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        company_name: product.company_name,
        tenant_id: product.tenant_id,
        image_url: product.image_url,
        stock_quantity: product.stock_quantity,
        quantity,
      }];
    });
  };

  const updateQuantity = (productId, quantity) => {
    const qty = Math.max(1, quantity);
    setItems((prev) => prev.map((i) => (i.id === productId ? { ...i, quantity: qty } : i)));
  };

  const removeItem = (productId) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const clearCart = () => setItems([]);

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0),
    [items],
  );

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      totalItems,
      totalAmount,
    }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
