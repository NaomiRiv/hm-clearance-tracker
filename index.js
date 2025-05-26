import fs from "fs";
import { urls } from "./urls.js";

async function fetchProducts(address) {
  // TODO: implement fetchProducts
}

(async () => {
  for (const url of urls) {
    console.log(`Processing ${url.label}...`);

    const productsFileName = url.fileName;
    try {
      // Fetch products from the website
      const fetchedProducts = await fetchProducts(url.url);

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

      // TODO: Update the products file
    } catch (error) {
      console.error(`Error processing ${url.label}:`, error);
    }
  }
})();
