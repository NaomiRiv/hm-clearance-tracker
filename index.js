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
  // Ensure the function can handle asynchronous calls
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
    sizes: product.sizes.map((size) => ({
      sizeCode: size.sizeCode,
      name: size.name,
      availability: false, // Placeholder for availability, to be updated later
    })),
  }));
  await updateProductSizesAvailability(products);

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

async function sendProductNotification(product) {
  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  console.log(`Sending telegram notification for ${product["productUrl"]}...`);
  const res = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: `New product added, check it out <a href="${product["productUrl"]}">link</a>`,
      parse_mode: "HTML",
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error(`Failed to send telegram notification:, ${data}`);
  } else {
    console.log(
      `Telegram notification was successfully sent for product ${product["articleId"]}`
    );
  }
}

async function sendProductsNotification(count, url) {
  const fullUrl = baseUrl + url.url;
  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  console.log(
    `Sending telegram notification about ${count} new items added to ${fullUrl}...`
  );
  const res = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: `${count} new products were added to the ${url.label.toLowerCase()} section, check them out <a href="${fullUrl}">link</a>`,
      parse_mode: "HTML",
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error(`Failed to send telegram notification:, ${data}`);
  } else {
    console.log(
      `Telegram notification was successfully sent for ${count} products in ${url.label.toLowerCase()}`
    );
  }
}

function sendNotifications(newProducts, url) {
  const newProductsCount = newProducts.length;
  if (newProductsCount <= MAX_SEPARATE_NOTIFICATIONS) {
    for (const product of newProducts) {
      sendProductNotification(product);
    }
  } else {
    sendProductsNotification(newProductsCount, url);
  }
}

async function getAvailableSizes(articleCode) {
  const ancestorProductCode = articleCode.slice(0, -3);
  const colorCode = articleCode.slice(-3);
  const url = `https://www2.hm.com/hmwebservices/service/product/il/availability/${ancestorProductCode}.json`;
  const response = await fetch(url);
  const json = await response.json();
  const availableSizesCodes = json["availability"];
  console.log(
    `Available sizes for ${ancestorProductCode}:`,
    availableSizesCodes
  );

  return availableSizesCodes;
}
async function updateProductSizesAvailability(products) {
  for (const product of products) {
    const availableSizes = await getAvailableSizes(product.articleCode);
    product.sizes.forEach((size) => {
      size.availability = availableSizes.includes(size.sizeCode);
    });
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
      const databasePath = "./tracking_files";
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
      console.log(
        `New products found for ${url.label}:`,
        newProducts.map((product) => product.productUrl)
      );
      sendNotifications(newProducts, url);

      // Update the products file
      fs.writeFileSync(productsPath, JSON.stringify(fetchedProducts, null, 2));
    } catch (error) {
      console.error(`Error processing ${url.label}:`, error);
    }
  }
})();
