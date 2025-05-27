import fs from "fs";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { Telegraf } from "telegraf";

import { baseUrl, urls } from "./urls.js";

dotenv.config();

const MAX_SEPARATE_NOTIFICATIONS = 6;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const bot = new Telegraf(BOT_TOKEN);

async function fetchProducts(address) {
  const response = await fetch(address);
  const html = await response.text();
  const $ = cheerio.load(html);

  const nextDataScript = $("#__NEXT_DATA__").html();
  if (!nextDataScript) {
    console.error("No __NEXT_DATA__ script found.");
    process.exit(1);
  }

  const nextData = JSON.parse(nextDataScript);
  const rawProducts =
    nextData.props.pageProps.plpProps.productListingProps.hits;

  // console.log(JSON.stringify(rawProducts, null, 2)); // Debugging line

  // Extract the relevant product data
  const products = rawProducts.map((product) => ({
    imageSrc: product.imageProductSrc,
    articleCode: product.articleCode,
    productUrl: product.pdpUrl,
    title: product.title,
    regularPrice: product.regularPrice,
    discountPrice: product.redPrice,
    sizes: product.sizes,
  }));

  // console.log(JSON.stringify(products, null, 2)); // Debugging line

  return products;
}

function getAddedNewItems(productsPath, fetchedProducts) {
  // Read the existing products from the file
  const existingProducts = JSON.parse(fs.readFileSync(productsPath, "utf-8"));

  // Compare the fetched products with the existing ones
  const existingProductCodes = new Set(
    existingProducts.map((product) => product.articleCode)
  );
  const newProducts = fetchedProducts.filter(
    (product) => !existingProductCodes.has(product.articleCode)
  );
  return newProducts;
}

function sendTelegramNotification(product) {
  // TODO : implement
}

function sendNotifications(newProducts) {
  if (newProducts.length <= MAX_SEPARATE_NOTIFICATIONS) {
    for (const product of newProducts) {
      sendTelegramNotification(product);
    }
  } else {
  }
}

(async () => {
  for (const url of urls) {
    console.log(`Processing ${url.label}...`);

    const productsFileName = url.fileName;
    try {
      // Fetch products from the website
      const fetchedProducts = await fetchProducts(baseUrl + url.url);

      // If Database folder doesn't exist, create it
      const databasePath = "./Database";
      if (!fs.existsSync(databasePath)) {
        fs.mkdirSync(databasePath);
      }

      const productsPath = `${databasePath}/${productsFileName}`;
      // If the products file doesn't exist, create it with the fetched data
      if (!fs.existsSync(productsPath)) {
        fs.writeFileSync(
          productsPath,
          JSON.stringify(fetchedProducts, null, 2)
        );
        console.log(
          `Products file (${productsPath}) created with fetched products for ${url.label} in the Database folder.`
        );
        // Nothing to compare to, continue
        continue;
      }

      const newProducts = getAddedNewItems(productsPath, fetchedProducts);

      // No new products were added, continue
      if (newProducts.length == 0) {
        console.log(`No products were added to ${url.label}.`);
        continue;
      }

      // send notification
      console.log(`New products found for ${url.label}:`, newProducts);
      sendNotifications(newProducts);

      // TODO: Update the products file
    } catch (error) {
      console.error(`Error processing ${url.label}:`, error);
    }
  }
})();
