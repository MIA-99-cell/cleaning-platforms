import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { resolveAssetUrl } from '../services/api';
import { formatCFA } from '../utils/currency';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import ProductCheckoutModal from './ProductCheckoutModal';
import CartPanel from './CartPanel';
import toast from 'react-hot-toast';
import './CartPanel.css';

const productImage = (url) => (url ? url : null);

const MarketplaceSection = ({ title = 'Cleaning Products Marketplace', limit, showCart = true }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    api.get('/customer/products')
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setProducts(limit ? list.slice(0, limit) : list);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [limit]);

  const requireCustomer = () => {
    if (!user) {
      toast('Please sign in as a customer to shop.', { icon: 'ℹ️' });
      navigate('/login');
      return false;
    }
    if (user.role !== 'customer') {
      toast.error('Only customer accounts can purchase products.');
      return false;
    }
    return true;
  };

  const handleAddToCart = (product) => {
    if (!requireCustomer()) return;
    addItem(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  const handleBuyNow = (product) => {
    if (!requireCustomer()) return;
    setSelectedProduct(product);
  };

  return (
    <section className="landing-marketplace">
      <div className="landing-services-header">
        <h3>{title}</h3>
        <p>Shop cleaning supplies from verified companies. Add to cart or buy now. Pay on delivery or via Mobile Money.</p>
      </div>

      {loading ? (
        <p className="landing-services-empty">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="landing-services-empty">No products listed yet. Companies can add items from their dashboard.</p>
      ) : (
        <div className="marketplace-grid">
          {products.map((product) => (
            <article key={product.id} className="marketplace-card">
              <div className="marketplace-image-wrap">
                {productImage(product.image_url) ? (
                  <img src={resolveAssetUrl(product.image_url)} alt={product.name} className="marketplace-image" />
                ) : (
                  <div className="marketplace-image-placeholder">🧴</div>
                )}
              </div>
              <h4>{product.name}</h4>
              <p className="service-company">{product.company_name}</p>
              <p className="service-description">{product.description || 'Quality cleaning product.'}</p>
              {product.stock_quantity > 0 && (
                <p className="marketplace-stock">{product.stock_quantity} in stock</p>
              )}
              <div className="service-footer">
                <span className="service-price">{formatCFA(product.price)}</span>
              </div>
              <div className="marketplace-card-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleAddToCart(product)}>
                  Add to Cart
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleBuyNow(product)}>
                  Buy Now
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ProductCheckoutModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {showCart && <CartPanel />}
    </section>
  );
};

export default MarketplaceSection;
