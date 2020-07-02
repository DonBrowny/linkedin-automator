const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");

const loginButton =
  "#app__container > main > div:nth-child(2) > form > div.login__form_action_container > button";
const sendAgain = 'button[aria-label="Send now"]';
const moreClass = ".pv-s-profile-actions__overflow-toggle";
const moreOptionsClass = ".pv-s-profile-actions__label";
const removeConnection = "Remove Connection";

module.exports = async function processLineByLine(fileName, userName, pass) {
  if(!fileName || !userName || !pass){
    return;
  }
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  const fileStream = fs.createReadStream(fileName);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const urls = [];
  for await (const line of rl) {
    urls.push(line);
  }
  //Login into Linkedin
  await login(page,userName,pass);

  //Open all the connections and click on connect
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    writeFile(`${url}, ${await connect(url, page)}`);
  }
}

function writeFile(content) {
  var stream = fs.createWriteStream("./output.csv", { flags: "a" });
  stream.write(`${content}\n`);
  stream.end();
}

async function connect(url, page) {
  await page.goto(url);
  //Check whether the url is vaid
  const notFoundDiv = await page.$(".not-found")
  const inValidProfile = await page.$(".profile-unavailable")
  if(notFoundDiv || inValidProfile){
    return 'Invalid Url / Profile Unavailable'
  }
  //Check whether the connect button is present
  try {
    let connectSelector;
    const selector = await page.$$(".artdeco-button__text");
    for (const option of selector) {
      const label = await page.evaluate((el) => el.innerText, option);
      if (label === "Connect") {
        connectSelector = option;
      } else if (label === "Pending") {
        return "Pending";
      }
    }
    if (!connectSelector) {
      //Search and click connect if it is there inside more dropdown
      const moreButtonSelector = await page.$(moreClass);
      await moreButtonSelector.click();
      await page.waitFor(2000)
      const moreOptions = await page.$$(moreOptionsClass);
      for (const option of moreOptions) {
        const innerText = await page.evaluate((el) => el.innerText, option);
        if (innerText === "Connect") {
          connectSelector = option;
        } else if (innerText === "Pending") {
          return "Pending";
        } else if (innerText === "Remove Connection") {
          return "Already Connected";
        }
      }
    }
    await connectSelector.click();
    await page.waitForSelector(sendAgain);
    await page.click(sendAgain, { delay: 1000 });
  } catch (err) {
    return err.message;
  }
  return "Pending";
}

async function login(page,userName,pass) {
  await page.goto("https://www.linkedin.com/login");
  await page.type("input[id=username]", userName, { delay: 100 });
  await page.type("input[id=password]", pass);
  await Promise.all([
    page.click(loginButton, { delay: 1000 }),
    page.waitForNavigation(),
  ]);
}
