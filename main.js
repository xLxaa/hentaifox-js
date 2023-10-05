#!/usr/bin/env node
// A NodeJS script to download doujins from https://hentaifox.com either random or by ID. See the end
// of this file for usage, and have a play around.
//
// License MIT, see the main directory for a copy.


const fs = require("node:fs");
const jsdom = require("jsdom");
const {JSDOM} = jsdom;


class HentaiFoxDownloader {
    constructor (doujin_rate=1000, page_rate=1000) {
        this.doujin_rate = doujin_rate;
        this.page_rate = page_rate;
        console.log(`Rates Per Request: (doujin) ${this.doujin_rate}ms / (pages) ${this.page_rate}ms\n`);
    }

    get base_url() { return "https://hentaifox.com" };

    /**
     * Download all pages for each doujin in an array of doujins (represented as HTML DOMs).
     * 
     * @param {array} jsdom_data : An array of HTML DOMs for each doujin. 
     * @param {string} dir       : The base directory in which to store each doujin.
     * @param {number} page_rate : The rate of which to send the requests for each page (this is shared over 2 requests).
     */
    download_pages = async (jsdom_data, dir="./doujins") => {
        for(let doujin of jsdom_data) {
            // Perhaps can done with less requests, but this is the easiest way to get ext right/ get all pages.
            const title = doujin.window.document.querySelector("div.info h1").innerHTML.trim();
            const pages = doujin.window.document.querySelector("div.info span.pages").innerHTML.trim().match(/\d+/)[0];
            const id = doujin.window.gallery_id[0].value.trim();
            const full_dir = `${dir}/${id} - ${title}`;
            await fs.promises.mkdir(full_dir, { recursive: true });

            console.log(`Title : ${title}\nPages : ${pages}\nID    : ${id}`);
            // Download pages for each doujin (dom) in the array of doujins.
            for(let i = 1; i < pages; i ++) {  // Index starts at 1 as index 0 is always `https://i*.hentaifox.com/*/*/0.`.
                const response = await fetch(`${this.base_url}/g/${id}/${i}`);
                const page_dom = new JSDOM(await response.text());
                // `getAttribute` dom method used to get the true src to the lazy loaded images.
                const page_dest = new URL(page_dom.window.document.getElementById("gimg").getAttribute("data-src").trim());
                const page_bytes = (await fetch(page_dest)).body; // `body` for bytes `ReadableStream<Uint8Array>`.
                await fs.promises.writeFile(`${full_dir}/${page_dest.pathname.split("/")[3]}`, page_bytes, () => {});
                process.stdout.write(`\rCurrently downloading: page ${i}...`); // For no trailing newline.
                await new Promise((resolve) => setTimeout(resolve, this.page_rate));
            }
            console.log("\nDone!\n");
        }
    }

    /**
     * Download a specified number of doujins into a chosen directory.
     * 
     * @param {number} how_many : The number of random doujins in which to fetch. 
     * @param {str} dir         : The base directory to save the doujins under.
     */
    download_random = async (how_many, dir="./doujins", options={doujin_rate: 1000, page_rate: 1000}) => {
        let array = [];

        for(let i = 0; i < how_many; i++) {
            const response = await fetch(`${this.base_url}/random`);
            const data = await response.text();
            array.push(new JSDOM(data)); 
            await new Promise((resolve) => setTimeout(resolve, this.doujin_rate));
        }

        await this.download_pages(array, dir);
    }

    /**
     * Download doujin(s) using an array of doujin ID(s).
     * 
     * @param {number} ids : An array of doujin IDs (number) to download. 
     * @param {str} dir    : The base directory to save the doujins under.
     */
    download_id = async (ids=[], dir="./doujins") => {
        let array = [];

        for(let id of ids) {
            const response = await fetch(`${this.base_url}/gallery/${id}`);
            const data = await response.text();
            array.push(new JSDOM(data)); 
            await new Promise((resolve) => setTimeout(resolve, this.doujin_rate));
        }

        await this.download_pages(array, dir);
    }
}


// You can always increase/ decrease the cooldown rate for each request, I would just say leave it as it is.
const hentaifox = new HentaiFoxDownloader(1000, 1000);
// hentaifox.download_id([41666, 116690], "./doujins-id"); // Download using IDs in array into `./doujins-id/*`.
hentaifox.download_random(3, "./doujins-random");       // Download an amount of random posts `./doujins-random/*`.
