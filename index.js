import fs from "fs";
import * as cheerio from "cheerio";

import { baseUrl, urls } from "./urls.js";

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
    productUrl: product.pdpUrl,
    title: product.title,
    regularPrice: product.regularPrice,
    discountPrice: product.redPrice,
    sizes: product.sizes,
  }));

  // console.log(JSON.stringify(products, null, 2)); // Debugging line

  return products;
}

(async () => {
  for (const url of urls) {
    console.log(`Processing ${url.label}...`);

    const productsFileName = url.fileName;
    try {
      // Fetch products from the website
      const fetchedProducts = await fetchProducts(baseUrl + url.url);

      
      // If the products file doesn't exist, create it with the fetched data
      if (!fs.existsSync(productsFileName)) {
        fs.writeFileSync(
          productsFileName,
          JSON.stringify(fetchedProducts, null, 2)
        );
        console.log(
          `Products file created with fetched products for ${url.label}.`
        );
        // Nothing to compare to, continue
        continue;
      }

      // Read the existing products from the file
      const existingProducts = JSON.parse(
        fs.readFileSync(productsFileName, "utf-8")
      );

      // TODO: Compare the fetched products with the existing ones

      // TODO: No new products were added, exit

      // TODO: send notification
    */
      // TODO: Update the products file
    } catch (error) {
      console.error(`Error processing ${url.label}:`, error);
    }
  }
})();
