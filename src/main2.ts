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

// 2.创建一个爬虫实例
const myXCrawl = xCrawl({
  maxRetry: 3,
  intervalTime: { max: 2000, min: 1000 },
  timeout: 20000,
});
const PageLists = await myXCrawl.crawlPage(
  {
    url: "https://www.biquge365.net/newbook/892751/",
    viewport: { width: 1920, height: 1080 },
  },
  res => {
    res.crawlErrorQueue.forEach(el => console.log(el.message));
  }
);
const { browser } = PageLists.data;
let { page } = PageLists.data;
await page.waitForXPath("/html/body/div[1]/div[4]/ul/li[1]/a");
await page.screenshot({ path: "./image/listPage.png" });

// 获取章节列表url
const sectionsFragmentUrlList = await page.$$eval(".info a", els =>
  els.map(el => el.href)
);
console.log(sectionsFragmentUrlList);
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
    await page.waitForSelector(".gongneng1 ~ h1");
    await page.waitForSelector("#txt");
    await page.screenshot({ path: `./image/detailPage${index}.png` });
    const title = await page.$eval(".gongneng1 ~ h1", el => el.innerHTML);
    let content = await page.$eval("#txt", el =>
      el.innerHTML
        .replace(
          '<p style="font-weight:bold" ;="">一秒记住【笔趣阁】biquge365.net，更新快，无弹窗！</p><br>',
          ""
        )
        .replaceAll("&nbsp;&nbsp;&nbsp;&nbsp;", "<p>")
        .replaceAll("<br>", "</p>")
    );

    let fileName = `Section${(index + 1).toString().padStart(6, "0")}.xhtml`;
    let filePath = path.resolve(__dirname, `./html/${fileName}`);
    await page.close();
    const detail = template(title, content);
    const nav = navTemplate(title, fileName);
    const navConfig = navConfigTemplate(title, fileName, index);

    fs.writeFile(filePath, detail, err => {
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
    JSON.stringify(titleList.map(i => i.title)),
    err => {
      resolve(null);
    }
  );
});

await new Promise((resolve, reject) => {
  fs.writeFile(
    path.resolve(__dirname, "./data/nav.html"),
    titleList.map(i => i.nav).join(os.EOL),
    err => {
      resolve(null);
    }
  );
});
await new Promise((resolve, reject) => {
  fs.writeFile(
    path.resolve(__dirname, "./data/navConfig.html"),
    titleList.map(i => i.navConfig).join(os.EOL),
    err => {
      resolve(null);
    }
  );
});

await browser.close();
