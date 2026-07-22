import { FLUTTERWAVE_NETWORKS } from '../utils/flutterwave';

// Shared delivery/payment form fields used by the product and cart checkout modals.
// `checkout` is the object returned by useCheckoutForm. `children` renders extra
// fields (e.g. quantity) above the payment method selector.
const CheckoutFields = ({ checkout, onClose, children }) => {
  const {
    paymentMethod, setPaymentMethod,
    deliveryAddress, setDeliveryAddress,
    contactEmail, setContactEmail,
    deliveryPhone, setDeliveryPhone,
    network, setNetwork,
    transactionRef, setTransactionRef,
    notes, setNotes,
    loading,
  } = checkout;

  const submitLabel = paymentMethod === 'flutterwave'
    ? 'Pay with Flutterwave'
    : paymentMethod === 'mobile_money'
      ? 'Submit Payment'
      : 'Place Order';

  return (
    <>
      {children}

      <div className="form-group">
        <label>Payment Method</label>
        <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
          <option value="flutterwave">Pay with Flutterwave (MoMo / Card)</option>
          <option value="cash_on_delivery">Pay on Delivery</option>
          <option value="mobile_money">Mobile Money (Manual)</option>
        </select>
      </div>

      <div className="form-group">
        <label>Delivery Address</label>
        <input className="form-control" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required />
      </div>

      <div className="form-group">
        <label>Email (required for order confirmation)</label>
        <input type="email" className="form-control" value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)} required />
      </div>

      <div className="form-group">
        <label>Phone Number</label>
        <input className="form-control" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} placeholder="+237..." required />
      </div>

      {paymentMethod === 'flutterwave' && (
        <div className="form-group">
          <label>Mobile Money Network</label>
          <select className="form-control" value={network} onChange={(e) => setNetwork(e.target.value)} required>
            {FLUTTERWAVE_NETWORKS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
      )}

      {paymentMethod === 'mobile_money' && (
        <div className="form-group">
          <label>MoMo Transaction Reference</label>
          <input className="form-control" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="e.g. MTN-123456" />
        </div>
      )}

      <div className="form-group">
        <label>Notes (optional)</label>
        <textarea className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Processing...' : submitLabel}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
};

export default CheckoutFields;
