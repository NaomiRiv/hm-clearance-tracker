import fs from "fs";
import * as cheerio from "cheerio";
import { Telegraf } from "telegraf";

import logger from "./logger.js";
import { baseUrl, urls } from "./urls.js";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = new Telegraf(botToken);

const AvailabilityStatus = Object.freeze({
  UNDEFINED: -1,
  OUT_OF_STOCK: 0,
  FEW_LEFT: 1,
  IN_STOCK: 2,
});

function formatNewProductMessage(product, category) {
  const inStockSizes = product.sizes
    .filter(
      (size) =>
        size.availability === AvailabilityStatus.FEW_LEFT ||
        size.availability === AvailabilityStatus.IN_STOCK
    )
    .map((s) => s.name);

  const fewLeftSizes = product.sizes
    .filter((size) => size.availability === AvailabilityStatus.FEW_LEFT)
    .map((s) => s.name);

  return `🆕 נוסף מוצר חדש בקטגוריית ${category}

📌 <a href="${product.productUrl}">${product.title}</a>
📏 מידות זמינות:${inStockSizes.length > 0 ? ` ${inStockSizes.join(", ")}` : ""}
${
  fewLeftSizes.length > 0
    ? `⚠️ נותרו יחידות בודדות מהמידות: ${fewLeftSizes.join(", ")}`
    : ""
}
💸 מחיר קודם: ${product.regularPrice}  
🔥 מחיר חדש: ${product.discountPrice} (${product.discountPercentage} הנחה)`;
}

async function fetchProducts(address) {
  // Ensure the function can handle asynchronous calls
  const response = await fetch(address);
  const html = await response.text();
  const $ = cheerio.load(html);

  const nextDataScript = $("#__NEXT_DATA__").html();
  if (!nextDataScript) {
    logger.fatal("No __NEXT_DATA__ script found.");
    process.exit(1);
  }

  const nextData = JSON.parse(nextDataScript);
  const rawProducts =
    nextData.props.pageProps.plpProps.productListingProps.hits;

  logger.debug(
    `Fetched raw products data from ${address}: 
    ${JSON.stringify(rawProducts[0], null, 2)}`
  );

  // Extract the relevant product data
  const products = rawProducts.map((product) => ({
    imageSrc: product.imageProductSrc,
    articleCode: product.articleCode,
    productUrl: product.pdpUrl,
    title: product.title,
    regularPrice: product.regularPrice,
    discountPrice: product.redPrice,
    discountPercentage: product.discountPercentage?.replace("-", "") || "0%",
    sizes: product.sizes.map((size) => ({
      sizeCode: size.sizeCode,
      name: size.name,
      availability: AvailabilityStatus.UNDEFINED, // Placeholder for availability, to be updated later
    })),
  }));

  // await updateProductSizesAvailability(products); // Add this line here if you want to compare the available sizes of existing items

  logger.debug(
    `Fetched processed products data from ${address}: 
    ${JSON.stringify(rawProducts[0], null, 2)}`
  );

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

async function sendProductNotification(product, category, isFirst) {
  logger.info(`Sending telegram notification for ${product["productUrl"]}...`);
  try {
    await bot.telegram.sendMessage(
      chatId,
      formatNewProductMessage(product, category),
      {
        parse_mode: "HTML",
        disable_notification: !isFirst,
      }
    );
    logger.info(
      `Telegram notification was successfully sent for product ${product["articleCode"]}`
    );
  } catch (error) {
    logger.error(`Failed to send telegram notification: ${error.message}`);
    // TODO: try again?
  }
}

function sendNotifications(newProducts, url) {
  let isFirst = true;
  for (const product of newProducts) {
    sendProductNotification(product, url.label, isFirst);
    isFirst = false;
  }
}

async function getAvailableSizes(articleCode) {
  const ancestorProductCode = articleCode.slice(0, -3);
  const colorCode = articleCode.slice(-3);
  const url = `https://www2.hm.com/hmwebservices/service/product/il/availability/${ancestorProductCode}.json`;
  const response = await fetch(url);
  const json = await response.json();
  const availableSizesCodes = json["availability"];
  const fewLeftSizesCodes = json["fewPieceLeft"];
  logger.info(
    `Available sizes for ${ancestorProductCode}: ${availableSizesCodes}`
  );

  return [availableSizesCodes, fewLeftSizesCodes];
}
async function updateProductSizesAvailability(products) {
  for (const product of products) {
    const [availableSizesCodes, fewLeftSizesCodes] = await getAvailableSizes(
      product.articleCode
    );
    product.sizes.forEach((size) => {
      if (fewLeftSizesCodes.includes(size.sizeCode)) {
        size.availability = AvailabilityStatus.FEW_LEFT;
      } else if (availableSizesCodes.includes(size.sizeCode)) {
        size.availability = AvailabilityStatus.IN_STOCK;
      } else {
        size.availability = AvailabilityStatus.OUT_OF_STOCK;
      }
    });
  }
}

(async () => {
  for (const url of urls) {
    logger.info(`Processing ${url.label}...`);

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
        logger.info(
          `Products file (${productsPath}) created with fetched products for ${url.label} in the Database folder.`
        );
        // Nothing to compare to, continue
        continue;
      }

      const newProducts = getAddedNewItems(productsPath, fetchedProducts);

      // No new products were added, continue
      if (newProducts.length == 0) {
        logger.info(`No products were added to ${url.label}`);
        continue;
      }

      // Update the availability of sizes for new products before sending notifications
      await updateProductSizesAvailability(newProducts);

      // send notification
      logger.info(
        `New products found for ${url.label}: ${newProducts
          .map((product) => product.productUrl)
          .join(", ")}`
      );
      sendNotifications(newProducts, url);

      // Update the products file
      fs.writeFileSync(productsPath, JSON.stringify(fetchedProducts, null, 2));
    } catch (error) {
      logger.error(`Error processing ${url.label}: ${error.message}`);
    }
  }
})();
