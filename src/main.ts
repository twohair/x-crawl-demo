// 1.导入模块 ES/CJS
import xCrawl from "x-crawl";
import fs from "node:fs";
import path from "node:path";
const __dirname = path.resolve(path.dirname(""));
const template = (title: string, content: string) => {
  return `<?xml version="1.0" encoding="utf-8" ?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
<head>
<title>${title}</title>
<link href="../Styles/section-common.css" type="text/css" rel="stylesheet"/><style type="text/css">
@page { margin-bottom: 5.000000pt; margin-top: 5.000000pt; }</style>
</head>
<body>
  <h2><span style="border-bottom:1px solid">${title}</span></h2>
  ${content}
  <p></p>
  <p></p>
  <p></p>
  <p></p>
  <p></p>
  <p></p>
  <div class="mbppagebreak"></div>
</body>
</html>`;
};

// 2.创建一个爬虫实例
const myXCrawl = xCrawl({
  maxRetry: 0,
  intervalTime: { max: 2000, min: 1000 },
  timeout: 20000,
});
const PageLists = await myXCrawl.crawlPage(
  {
    url: "https://www.biqge.org/book/19995",
    viewport: { width: 1920, height: 1080 },
  },
  (res) => {
    res.crawlErrorQueue.forEach((el) => console.log(el.message));
  }
);
const { browser } = PageLists.data;
let { page } = PageLists.data;
await page.waitForSelector("#indexselect");
await page.screenshot({ path: "./image/homePage.png" });
// 每50章一条url列表，获取所有url列表链接
const urlLists = await page.$$eval("#indexselect option", (els) => {
  return els.map((el) => `https://www.biqge.org${el.value}`);
});
console.log(urlLists);
await page.close();
// 获取章节列表url
const sectionFragment = await myXCrawl.crawlPage({
  targets: urlLists, // TODO
  viewport: { width: 1920, height: 1080 },
});
const sectionsFragmentUrlList = await Promise.all(
  sectionFragment.map(async (item, index) => {
    const { page } = item.data;
    await page.waitForXPath(
      "/html/body/div[3]/div[2]/div[1]/div[2]/ul/li[1]/a"
    );
    await page.screenshot({ path: `./image/listPage${index}.png` });
    const sectionFragmentList = await page.$$(".section-list");
    let res = await sectionFragmentList[1].$$eval("a", (els) =>
      els.map((el) => el.href)
    );
    await page.close();
    return res;
  })
);
console.log(sectionsFragmentUrlList);
const titleList: string[][] = await Promise.all(
  sectionsFragmentUrlList.map(async (item, index) => {
    const sections = await myXCrawl.crawlPage({
      targets: item,
      viewport: { width: 1920, height: 1080 },
    });
    return await Promise.all(
      sections.map(async (item, index) => {
        const { page } = item.data;
        await page.waitForSelector(".title");
        await page.waitForSelector("#next_url");
        await page.waitForSelector("#content");
        await page.screenshot({ path: `./image/detailPage${index}.png` });
        const title = await page.$eval(".title", (el) =>
          el.innerHTML.replace(/（.+）/, "")
        );
        let content = await page.$eval("#content", (el) => el.innerHTML);
        while (
          await page.$eval(
            "#next_url",
            (el) => el.textContent?.trim() !== "下一章"
          )
        ) {
          await page.click("#next_url");
          content += await page.$eval("#content", (el) => el.innerHTML);
        }
        await page.close();
        const res = template(title, content);
        let filename = path.resolve(
          __dirname,
          `./html/Section${(index + 1).toString().padStart(6, "0")}.xhtml`
        );
        await new Promise((resolve, reject) => {
          fs.writeFile(filename, res, (err) => {
            if (err) reject`文件写入错误`;
            resolve("success");
          });
        });

        return title;
      })
    );
  })
);

await new Promise((resolve, reject) => {
  fs.writeFile(
    path.resolve(__dirname, "./title.json"),
    JSON.stringify(titleList.flat()),
    (err) => {
      resolve(null);
    }
  );
});

await browser.close();
