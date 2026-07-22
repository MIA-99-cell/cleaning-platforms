import { useEffect, useState } from 'react';
import api, { resolveAssetUrl } from '../services/api';
import { formatCFA } from '../utils/currency';
import { useCart } from '../contexts/CartContext';
import ProductCheckoutModal from './ProductCheckoutModal';
import CartPanel from './CartPanel';
import toast from 'react-hot-toast';
import './CartPanel.css';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

const productImage = (url) => (url ? url : null);

const MarketplaceSection = ({ title = 'Cleaning Products Marketplace', limit, showCart = true }) => {
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [loadError, setLoadError] = useState('');

  useLockBodyScroll(!!selectedProduct);

  useEffect(() => {
    const loadProducts = () => {
      setLoading(true);
      setLoadError('');
      fetchWithRetry(() => api.get('/public/products', { params: { limit: limit || 50 } }))
        .then((res) => {
          const list = Array.isArray(res.data?.data) ? res.data.data : [];
          setProducts(limit ? list.slice(0, limit) : list);
        })
        .catch(() => {
          setProducts([]);
          setLoadError('Could not load products. The server may be waking up — please wait a moment and refresh.');
        })
        .finally(() => setLoading(false));
    };

    loadProducts();
    const onFocus = () => loadProducts();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [limit]);

  const handleAddToCart = (product) => {
    addItem(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  const handleBuyNow = (product) => {
    setSelectedProduct(product);
  };

  return (
    <section id="marketplace" className="landing-marketplace">
      <div className="landing-services-header">
        <h3>{title}</h3>
        <p>Shop cleaning supplies from verified companies. No account needed — add to cart or buy now.</p>
      </div>

      {loading ? (
        <p className="landing-services-empty">Loading products… (first load can take up to a minute on free hosting)</p>
      ) : loadError ? (
        <p className="landing-services-empty">{loadError}</p>
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
