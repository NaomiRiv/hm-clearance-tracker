# 🛍️ HM Clearance Tracker
A Node.js app that tracks clearance items from the H&M Israel website. 
The script retrieves product data from specified URLs and sends notifications about new items added to the clearance sections, 
helping you to track clearance deals without wasting your time.

---

## 🚀 Features
- Scrapes clearance product data from H&M Israel
- Saves items to a local SQLite database 
- Docker-compatible for easy deployment
- Basic logging support

---

## 📦 Tech Stack
- Node.js (version 20 or higher)
- Cheerio (for HTTP & HTML parsing)
- SQLite (via `better-sqlite3`)
- Docker

---

## 📁 Project Structure
```
├── index.js           # Entry point for the scraping logic
├── urls.js            # List of product category URLs to scrape
├── db.js              # SQLite database logic and schema setup
├── logger.js          # Simple console logger
├── Dockerfile         # Docker configuration
├── package.json       # Project metadata and dependencies
├── database.db        # SQLite database (generated at runtime)
```
---

## Telegram Channel 
https://t.me/hm_clearance
