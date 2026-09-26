import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

async function makeTransparent() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  const inputPath = path.resolve("artifacts/zelevos/public/icon_zelevos.png");
  const imgBase64 = fs.readFileSync(inputPath).toString("base64");

  const transparentBase64 = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          // Pure or near white background removal
          if (r > 240 && g > 240 && b > 240) {
            data[i+3] = 0;
          } else if (r > 200 && g > 200 && b > 200) {
            // Anti-aliasing fringe transition
            const diff = 240 - ((r + g + b) / 3);
            data[i+3] = Math.max(0, Math.min(255, Math.round((diff / 40) * 255)));
          }
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png").split(",")[1]);
      };
      img.src = "data:image/png;base64," + b64;
    });
  }, imgBase64);

  const outputPath = path.resolve("artifacts/zelevos/public/icon_zelevos_transparent.png");
  fs.writeFileSync(outputPath, Buffer.from(transparentBase64, "base64"));
  console.log("Saved transparent icon to:", outputPath);
  await browser.close();
}

makeTransparent().catch(console.error);
