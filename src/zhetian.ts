// 1.导入模块 ES/CJS
import xCrawl from "x-crawl";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const __dirname = path.resolve(path.dirname(""));
const navTemplate = (title: string, fileName: string) =>
  `<li class="catalog"><a href="${fileName}">${title}</a></li>`;
const navConfigTemplate = (title: string, fileName: string, id: number) =>
  `<navPoint id="navPoint-${id + 2}" playOrder="${id + 2}">
  <navLabel>
    <text>${title}</text>
  </navLabel>
  <content src="Text/${fileName}"/>
</navPoint>`;
const template = (title: string, content: string) => {
  return `<?xml version="1.0" encoding="utf-8" ?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
<head>
<title>${title}</title>
<link href="../Styles/section-common.css" type="text/css" rel="stylesheet"/>
<style type="text/css">
@page { margin-bottom: 5.000000pt; margin-top: 5.000000pt; }
</style>
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

if (!fs.existsSync("./html")) {
  fs.mkdirSync("./html");
}
if (!fs.existsSync("./image")) {
  fs.mkdirSync("./image");
}
if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data");
}
// 2.创建一个爬虫实例
const myXCrawl = xCrawl({
  maxRetry: 3,
  intervalTime: { max: 2000, min: 1000 },
  timeout: 20000,
});
const PageLists = await myXCrawl.crawlPage(
  {
    url: "https://www.qishuta.org/du/23/23858/",
    viewport: { width: 1920, height: 1080 },
  },
  (res) => {
    res.crawlErrorQueue.forEach((el) => console.log(el.message));
  }
);
const { browser } = PageLists.data;
let { page } = PageLists.data;
await page.waitForXPath("/html/body/div[3]/div[5]/div[1]/ul");
await page.screenshot({ path: "./image/listPage.png" });
// 获取主体
const mainContent = (await page.$$(".pc_list"))[1];
// 获取章节列表url
const sectionsFragmentUrlList = await mainContent.$$eval("a", (els) => {
  return els.map((el) => el.href);
});

// console.log(sectionsFragmentUrlList);
await page.close();

const sections = await myXCrawl.crawlPage({
  targets: sectionsFragmentUrlList,
  viewport: { width: 1920, height: 1080 },
});
interface TitleAndNav {
  title: string;
  nav: string;
  navConfig: string;
}
const titleList: TitleAndNav[] = await Promise.all(
  sections.map(async (item, index) => {
    const { page } = item.data;
    await page.waitForSelector(".txt_cont > h1");
    await page.waitForSelector("#content1");
    // await page.screenshot({ path: `./image/detailPage${index}.png` });
    const title = await page.$eval(".txt_cont > h1", (el) =>
      el.innerHTML.trim()
    );
    let content = await page.$eval("#content1", (el) => {
      return el.innerHTML
        .replace(/<p class="sitetext">.*\n.*\n<br>\n<br>/, "")
        .replaceAll('<p class="sitetext">最新网址：www.qishuta.org</p>', "")
        .replaceAll("&nbsp;&nbsp;&nbsp;&nbsp;", "<p>")
        .replaceAll("<br>", "</p>");
    });
    let fileName = `Section${(index + 1).toString().padStart(6, "0")}.xhtml`;
    let filePath = path.resolve(__dirname, `./html/${fileName}`);
    await page.close();
    const detail = template(title, content);
    const nav = navTemplate(title, fileName);
    const navConfig = navConfigTemplate(title, fileName, index);

    fs.writeFile(filePath, detail, (err) => {
      if (err) throw `文件写入错误`;
    });
    return {
      title,
      nav,
      navConfig,
    };
  })
);
await new Promise((resolve, reject) => {
  fs.writeFile(
    path.resolve(__dirname, "./data/title.json"),
    JSON.stringify(titleList.map((i) => i.title)),
    (err) => {
      resolve(null);
    }
  );
});

await new Promise((resolve, reject) => {
  fs.writeFile(
    path.resolve(__dirname, "./data/nav.html"),
    titleList.map((i) => i.nav).join(os.EOL),
    (err) => {
      resolve(null);
    }
  );
});
await new Promise((resolve, reject) => {
  fs.writeFile(
    path.resolve(__dirname, "./data/navConfig.html"),
    titleList.map((i) => i.navConfig).join(os.EOL),
    (err) => {
      resolve(null);
    }
  );
});

await browser.close();
