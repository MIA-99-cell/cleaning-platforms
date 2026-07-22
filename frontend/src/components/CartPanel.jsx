import { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { formatCFA } from '../utils/currency';
import CartCheckoutModal from './CartCheckoutModal';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import './CartPanel.css';

const CartPanel = () => {
  const {
    items, totalItems, totalAmount, updateQuantity, removeItem, clearCart,
  } = useCart();
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useLockBodyScroll(open || checkoutOpen);

  const handleCheckout = () => {
    setOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="cart-fab"
        onClick={() => setOpen(true)}
        aria-label="Open cart"
      >
        🛒
        {totalItems > 0 && <span className="cart-fab-badge">{totalItems}</span>}
      </button>

      {open && (
        <>
          <div className="cart-backdrop" onClick={() => setOpen(false)} />
          <aside className="cart-drawer card">
            <div className="cart-drawer-header">
              <h3>Your Cart ({totalItems})</h3>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)}>✕</button>
            </div>

            {items.length === 0 ? (
              <p className="cart-empty">Your cart is empty. Add products from the marketplace.</p>
            ) : (
              <div className="cart-drawer-body">
                <div className="cart-items">
                  {items.map((item) => (
                    <div key={item.id} className="cart-item">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.company_name}</p>
                        <p>{formatCFA(item.price)} each</p>
                      </div>
                      <div className="cart-item-actions">
                        <input
                          type="number"
                          min={1}
                          max={item.stock_quantity > 0 ? item.stock_quantity : 99}
                          className="form-control cart-qty"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                        />
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-footer">
                  <strong>Total: {formatCFA(totalAmount)}</strong>
                  <div className="cart-footer-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={clearCart}>Clear</button>
                    <button type="button" className="btn btn-primary" onClick={handleCheckout}>Checkout</button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      {checkoutOpen && (
        <CartCheckoutModal onClose={() => setCheckoutOpen(false)} />
      )}
    </>
  );
};

export default CartPanel;
