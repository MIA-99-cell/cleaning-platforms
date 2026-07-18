import { useEffect, useState } from 'react';
import api, { resolveAssetUrl } from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA, CURRENCY_LABEL } from '../../utils/currency';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock_quantity: '0',
  });
  const [imageFile, setImageFile] = useState(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/tenant/products'),
      api.get('/tenant/product-orders'),
    ])
      .then(([productsRes, ordersRes]) => {
        setProducts(productsRes.data.data || []);
        setOrders(ordersRes.data.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('name', form.name);
      data.append('description', form.description);
      data.append('price', form.price);
      data.append('stock_quantity', form.stock_quantity || '0');
      if (imageFile) data.append('image', imageFile);

      await api.post('/tenant/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Product added to marketplace');
      setShowForm(false);
      setForm({ name: '', description: '', price: '', stock_quantity: '0' });
      setImageFile(null);
      fetchData();
    } catch {
      toast.error('Failed to create product');
    }
  };

  const toggleProduct = async (id, is_active) => {
    await api.put(`/tenant/products/${id}`, { is_active: !is_active });
    fetchData();
  };

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product? If it has past orders, it will be removed from the marketplace only.')) return;
    try {
      const res = await api.delete(`/tenant/products/${id}`);
      const msg = res.data?.message;
      toast.success(msg || 'Product deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const confirmOrder = async (id) => {
    setConfirmingId(id);
    try {
      await api.patch(`/tenant/product-orders/${id}/confirm`);
      toast.success('Payment confirmed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm');
    } finally {
      setConfirmingId(null);
    }
  };

  const deliverOrder = async (id) => {
    try {
      await api.patch(`/tenant/product-orders/${id}/deliver`);
      toast.success('Order marked as delivered');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order');
    }
  };

  const formatStatus = (status) => {
    const map = {
      payment_pending: 'Awaiting confirmation',
      paid: 'Payment confirmed',
      placed: 'Placed',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return map[status] || status?.replace(/_/g, ' ') || '-';
  };

  const formatPaymentMethod = (method) => {
    const map = {
      flutterwave: 'Flutterwave (MoMo)',
      mobile_money: 'Mobile Money',
      cash_on_delivery: 'Pay on delivery',
    };
    return map[method] || method?.replace(/_/g, ' ') || '-';
  };

  const statusBadgeClass = (status) => {
    if (status === 'paid' || status === 'delivered') return 'badge-success';
    if (status === 'payment_pending') return 'badge-warning';
    if (status === 'cancelled') return 'badge-danger';
    return 'badge-info';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Marketplace Products</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Product'}
        </button>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Upload cleaning goods to sell on the home page marketplace. Customers can pay on delivery or via Mobile Money.
      </p>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 520 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Product Name</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Price ({CURRENCY_LABEL})</label>
              <input type="number" min="0" step="0.01" className="form-control" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Stock Quantity (0 = unlimited)</label>
              <input type="number" min="0" className="form-control" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Product Image</label>
              <input type="file" accept="image/*" className="form-control" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </div>
            <button type="submit" className="btn btn-primary">Publish Product</button>
          </form>
        </div>
      )}

      <div className="card table-wrapper" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Your Products</h3>
        {loading ? <p>Loading...</p> : products.length === 0 ? (
          <div className="empty-state">No products yet. Add cleaning goods to sell on the marketplace.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.image_url ? (
                      <img src={resolveAssetUrl(p.image_url)} alt={p.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                    ) : '—'}
                  </td>
                  <td>{p.name}</td>
                  <td>{formatCFA(p.price)}</td>
                  <td>{p.stock_quantity > 0 ? p.stock_quantity : 'Unlimited'}</td>
                  <td><span className={`badge badge-${p.is_active ? 'success' : 'secondary'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => toggleProduct(p.id, p.is_active)}>
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => deleteProduct(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card table-wrapper">
        <h3 style={{ marginBottom: '1rem' }}>Product Orders</h3>
        {orders.length === 0 ? (
          <div className="empty-state">No product orders yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Amount</th>
                <th>Payment</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.id}</strong></td>
                  <td>{o.customer_name}</td>
                  <td>{o.product_name}</td>
                  <td>{o.quantity}</td>
                  <td>{formatCFA(o.total_amount)}</td>
                  <td>{formatPaymentMethod(o.payment_method)}</td>
                  <td><span className={`badge ${statusBadgeClass(o.status)}`}>{formatStatus(o.status)}</span></td>
                  <td>
                    {o.status === 'payment_pending' && ['mobile_money', 'flutterwave'].includes(o.payment_method) && (
                      <button className="btn btn-success btn-sm" disabled={confirmingId === o.id} onClick={() => confirmOrder(o.id)}>
                        {confirmingId === o.id
                          ? '...'
                          : o.payment_method === 'flutterwave'
                            ? 'Confirm Flutterwave'
                            : 'Confirm MoMo'}
                      </button>
                    )}
                    {['placed', 'paid'].includes(o.status) && (
                      <button className="btn btn-outline btn-sm" onClick={() => deliverOrder(o.id)}>
                        Mark Delivered
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Products;
