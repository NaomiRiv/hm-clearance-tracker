import Database from "better-sqlite3";
import logger from "./logger.js";
import fs from "fs";

const DATABASE_PATH = "./database.db";

const db = new Database(DATABASE_PATH);

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
            discountPercentage TEXT,
            lastSeen INT
        );
    `);
  /*
  db.exec(`
        CREATE TABLE IF NOT EXISTS sizes (
            sizeCode TEXT PRIMARY KEY,
            articleCode TEXT,
            name TEXT,
            availability INTEGER,
            FOREIGN KEY (articleCode) REFERENCES products(articleCode)
        );
    `);
    */
  logger.info("DB initialized.");
})();

// Check if database exists and is not empty
function isDatabaseSynced() {
  if (!fs.existsSync(DATABASE_PATH)) {
    return false;
  }

  const productCount = db
    .prepare("SELECT COUNT(*) as count FROM products")
    .get().count;
  return productCount > 0;
}

// Prepared insert statements
const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products (
    category, articleCode, imageSrc, productUrl, title,
    regularPrice, discountPrice, discountPercentage, lastSeen
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
/*
const insertSize = db.prepare(`
  INSERT OR REPLACE INTO sizes (
    sizeCode, articleCode, name, availability
  ) VALUES (?, ?, ?, ?)
`);
*/
// Insert full product + sizes
function insertFullProduct(product, date) {
  insertProduct.run(
    product.category,
    product.articleCode,
    product.imageSrc,
    product.productUrl,
    product.title,
    product.regularPrice,
    product.discountPrice,
    product.discountPercentage,
    date
  );
  /*
  for (const size of product.sizes) {
    insertSize.run(
      size.sizeCode,
      product.articleCode,
      size.name,
      size.availability
    );
  }
    */
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

// Sync
function syncDB(fetchedProducts, date, items_TTL) {
  // Update new products
  logger.info(`Syncing ${fetchedProducts.length} products to the database.`);

  for (const product of fetchedProducts) {
    insertFullProduct(product, date);
    logger.trace(`Updated product: ${product.articleCode}`);
  }
  cleanDB(items_TTL);
}

function cleanDB(items_TTL) {
  // Remove products not seen in the last 7 days (604800000 ms)
  const threshold = Date.now() - items_TTL;
  const oldProducts = db
    .prepare("SELECT articleCode FROM products WHERE lastSeen < ?")
    .all(threshold);

  if (oldProducts.length > 0) {
    const articleCodes = oldProducts.map((p) => p.articleCode);
    const placeholders = articleCodes.map(() => "?").join(",");
    /*
    db.prepare(`DELETE FROM sizes WHERE articleCode IN (${placeholders})`).run(
      ...articleCodes
    );
    */
    db.prepare(
      `DELETE FROM products WHERE articleCode IN (${placeholders})`
    ).run(...articleCodes);
    logger.info(`Removed ${articleCodes.length} old products from DB.`);
  }
}

export { syncDB, getNewAddedProducts, isDatabaseSynced };
