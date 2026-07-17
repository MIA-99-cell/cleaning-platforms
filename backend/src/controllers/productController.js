const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const getTenantProducts = async (req, res) => {
  try {
    const [products] = await pool.query(
      'SELECT * FROM products WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.tenantId]
    );
    sendSuccess(res, products);
  } catch (error) {
    console.error('getTenantProducts error:', error.message);
    sendError(res, 'Failed to fetch products', 500);
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock_quantity } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO products (tenant_id, name, description, price, stock_quantity, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.tenantId, name, description || null, price, stock_quantity || 0, image_url]
    );

    sendSuccess(res, { id: result.insertId }, 'Product created', 201);
  } catch (error) {
    console.error('createProduct error:', error.message);
    sendError(res, 'Failed to create product', 500);
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock_quantity, is_active } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : undefined;

    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (price !== undefined) { updates.push('price = ?'); params.push(price); }
    if (stock_quantity !== undefined) { updates.push('stock_quantity = ?'); params.push(stock_quantity); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (image_url) { updates.push('image_url = ?'); params.push(image_url); }

    if (!updates.length) return sendError(res, 'No fields to update', 400);

    params.push(id, req.tenantId);
    await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    sendSuccess(res, null, 'Product updated');
  } catch (error) {
    console.error('updateProduct error:', error.message);
    sendError(res, 'Failed to update product', 500);
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT id FROM products WHERE id = ? AND tenant_id = ?',
      [id, req.tenantId]
    );
    if (!existing.length) return sendError(res, 'Product not found', 404);

    const [orderRows] = await pool.query(
      'SELECT COUNT(*) AS count FROM product_orders WHERE product_id = ?',
      [id]
    );
    const orderCount = parseInt(orderRows[0]?.count || 0, 10);

    if (orderCount > 0) {
      await pool.query(
        'UPDATE products SET is_active = FALSE WHERE id = ? AND tenant_id = ?',
        [id, req.tenantId]
      );
      return sendSuccess(
        res,
        { archived: true },
        'Product has existing orders, so it was removed from the marketplace but kept in your records.'
      );
    }

    await pool.query('DELETE FROM products WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    sendSuccess(res, { archived: false }, 'Product deleted');
  } catch (error) {
    console.error('deleteProduct error:', error.message);
    if (error.code === '23503') {
      return sendError(
        res,
        'This product cannot be deleted because it has order history. It was deactivated instead.',
        409
      );
    }
    sendError(res, 'Failed to delete product', 500);
  }
};

const listMarketplaceProducts = async (req, res) => {
  try {
    const [products] = await pool.query(
      `SELECT p.*, c.company_name, c.logo_url AS company_logo
       FROM products p
       JOIN companies c ON p.tenant_id = c.tenant_id
       WHERE p.is_active = TRUE
       ORDER BY p.created_at DESC`
    );
    sendSuccess(res, products);
  } catch (error) {
    console.error('listMarketplaceProducts error:', error.message);
    sendError(res, 'Failed to load marketplace', 500);
  }
};

module.exports = {
  getTenantProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listMarketplaceProducts,
};
