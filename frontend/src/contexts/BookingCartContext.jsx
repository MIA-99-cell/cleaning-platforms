import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const BOOKING_CART_KEY = 'cleanpro_service_booking_cart';

const BookingCartContext = createContext(null);

const readCart = () => {
  try {
    const raw = localStorage.getItem(BOOKING_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const BookingCartProvider = ({ children }) => {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    localStorage.setItem(BOOKING_CART_KEY, JSON.stringify(items));
  }, [items]);

  const addBooking = (entry) => {
    setItems((prev) => [...prev, { ...entry, cartId: `${entry.service_id}-${Date.now()}` }]);
  };

  const removeBooking = (cartId) => {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const clearCart = () => setItems([]);

  const totalItems = useMemo(() => items.length, [items]);

  const totalAmount = useMemo(
    () => items.reduce((sum, i) => sum + parseFloat(i.price || 0), 0),
    [items],
  );

  return (
    <BookingCartContext.Provider value={{
      items,
      addBooking,
      removeBooking,
      clearCart,
      totalItems,
      totalAmount,
    }}
    >
      {children}
    </BookingCartContext.Provider>
  );
};

export const useBookingCart = () => {
  const ctx = useContext(BookingCartContext);
  if (!ctx) throw new Error('useBookingCart must be used within BookingCartProvider');
  return ctx;
};
