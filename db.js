import Database from "better-sqlite3";
import logger from "./logger.js";

const db = new Database("products.db");

// Create tables if not exist
(() => {
  db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            category TEXT,
            articleCode TEXT PRIMARY KEY,
            imageSrc TEXT,
            productUrl TEXT,
            title TEXT,
            regularPrice TEXT,
            discountPrice TEXT,
            discountPercentage TEXT
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS sizes (
            sizeCode TEXT PRIMARY KEY,
            articleCode TEXT,
            name TEXT,
            availability INTEGER,
            FOREIGN KEY (articleCode) REFERENCES products(articleCode)
        );
    `);

  logger.info("DB initialized.");
})();

// Prepared insert statements
const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products (
    category, articleCode, imageSrc, productUrl, title,
    regularPrice, discountPrice, discountPercentage
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSize = db.prepare(`
  INSERT OR REPLACE INTO sizes (
    sizeCode, articleCode, name, availability
  ) VALUES (?, ?, ?, ?)
`);

// Insert full product + sizes
function insertFullProduct(product, category) {
  insertProduct.run(
    product.category,
    product.articleCode,
    product.imageSrc,
    product.productUrl,
    product.title,
    product.regularPrice,
    product.discountPrice,
    product.discountPercentage
  );

  for (const size of product.sizes) {
    insertSize.run(
      size.sizeCode,
      product.articleCode,
      size.name,
      size.availability
    );
  }
}

function getNewAddedProducts(fetchedProducts) {
  if (fetchedProducts.length === 0) return [];
  const articleCodes = fetchedProducts.map((p) => p.articleCode);
  const placeholders = articleCodes.map(() => "?").join(",");
  const existingArticleCodes = db
    .prepare(
      `SELECT articleCode FROM products WHERE articleCode IN (${placeholders})`
    )
    .all(...articleCodes)
    .map((row) => row.articleCode);

  return fetchedProducts.filter(
    (product) => !existingArticleCodes.includes(product.articleCode)
  );
}

function getArticleCodesToRemove(fetchedArticleCodes, productsCategory) {
  const dbArticleCodes = db
    .prepare(`SELECT articleCode FROM products WHERE category = ?`)
    .all(productsCategory)
    .map((row) => row.articleCode);
  return dbArticleCodes.filter((code) => !fetchedArticleCodes.has(code));
}

// Sync
function syncDB(newProducts, fetchedProductsArticleCodes, productsCategory) {
  // Add new products
  for (const product of newProducts) {
    insertFullProduct(product);
    logger.info(`Inserted product: ${product.articleCode}`);
  }

  // Remove products not in fetchedProductsArticleCodes and are the the same productsCategory
  const toRemove = getArticleCodesToRemove(
    fetchedProductsArticleCodes,
    productsCategory
  );

  if (toRemove.length > 0) {
    const removePlaceholders = toRemove.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM sizes WHERE articleCode IN (${removePlaceholders})`
    ).run(...toRemove);
    db.prepare(
      `DELETE FROM products WHERE articleCode IN (${removePlaceholders})`
    ).run(...toRemove);
    logger.info(`Removed products: ${toRemove.join(", ")}`);
  } else {
    logger.info("No products to remove.");
  }
}

export { syncDB, getNewAddedProducts };
