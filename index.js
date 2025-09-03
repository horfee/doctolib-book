const {By, Builder, Browser} = require('selenium-webdriver');
let chrome = require('selenium-webdriver/chrome');
const readline = require('readline');
require("./logging.ts");

const askQuestion = (question) => {
  return new Promise((resolve) => {
    const rl = 
    readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
};


const args = process.argv.slice(2); // skip node + script name

const options = { 
    username: "",
    password: ""
};
const BYPASS_AUTH = false;


for (let i = 0; i < args.length; i++) {
  if ( args[i] === "-bypassauth" ) {
    BYPASS_AUTH = true;
  } else if ( args[i] === "-loglevel" && i + 1 < args.length ) {
    global.logLevel = args[i + 1];
    i++; // skip value
  } else if (args[i].startsWith('-')) {
    options[args[i].substring(1).toLowerCase()] = args[i + 1]; // take next value
    i++; // skip value
  }
}


_killFun = () => {
  console.log("Caught interrupt signal");
  process.exit();
};
process.on('SIGINT', _killFun);
process.on('SIGTERM', _killFun);
process.on('SIGQUIT', _killFun);



async function findElementWithText(driver, cssSelector, text) {
    let buttons = await driver.findElements(By.css(cssSelector));
    let res = [];
    for(let button of buttons) {
        let buttonText = await button.getText();
        if ( buttonText.toLowerCase() === text.toLowerCase()) {
            res.push(button);
        }
    }
    return res.length == 0 ? undefined : res;
}

(async function main() {
  let driver;
  
  try {
    console.debug("Starting browser");
    driver = await new Builder().forBrowser(Browser.CHROME).build();
    await driver.manage().setTimeouts({implicit: 1000});

    await driver.get('https://www.doctolib.fr/');
  
    let acceptCookies = await driver.findElement(By.css('button#didomi-notice-agree-button'));
    if ( acceptCookies !== undefined || acceptCookies.length == 0 ) {
        console.debug("Accepting cookies");
        await acceptCookies.click();
    }
    
    // let title = await driver.getTitle();
    // assert.equal("Web form", title);
  
    // 

    if ( !BYPASS_AUTH ) {
  
      console.debug("Searching for login button");
      let loginButton = await driver.findElement(By.css('a.dl-desktop-navbar-link'));
      if ( loginButton === undefined ) {
          console.error("Login button not found");
          return 1;
      }
      console.debug("Clicking on login button");
      await loginButton.click();

      loginButton = null;
      console.debug("Searching for login button");
      let loginOrSignupButtons = await findElementWithText(driver, "button:has( > span)", "Se connecter");
      for(let button of loginOrSignupButtons) {
          let text = await button.getText();
          if ( text.toLowerCase() === "se connecter") {
              loginButton = button;
              break;
          }
      }

      if ( loginButton === undefined ) {
          console.error("Login button not found");
          return 1;
      }

      console.debug("Clicking on login button");
      await loginButton.click();

      console.debug("Searching for username field");
      let userNameField = await driver.findElement(By.name('username'));
      if ( userNameField === undefined ) {
          console.error("Username field not found");
          return 1;
      }

      console.debug("Filling username field");
      
      await userNameField.sendKeys(options.username);
      let continueButton = await findElementWithText(driver, "button:has( > span)", "continuer");
      if ( continueButton === undefined || continueButton.length == 0 ) {
          console.error("Continue button not found");
          return 1;
      }
      console.debug("Clicking on continue button");
      await continueButton[0].click();

      console.debug("Searching for password field");
      let passwordField = await driver.findElement(By.id('input_:r0:'));
    
      if ( passwordField === undefined) {
          console.error("Password field not found");
          return 1;
      }
      
      console.debug("Filling password field");
      await passwordField.sendKeys(options.password);
      continueButton = await findElementWithText(driver, "button:has( > span)", "continuer");
      if ( continueButton === undefined || continueButton.length == 0 ) {
          console.error("Continue button not found");
          return 1;
      }
      console.debug("Clicking on continue button");
      await continueButton[0].click();


      console.debug("Waiting for redirection to finish");
      await driver.sleep(5000);

      let enterCodeReceivedText = await driver.findElement(By.xpath("//*[contains(text(),'Entrez le code reçu par email')]"));
      if ( enterCodeReceivedText === undefined) {
          console.error("2FA code request not found, login probably failed");
          return 1;
      }
      console.debug("2FA code request found, login successful so far");


      const F2ACode = await askQuestion('F2A Code ? ');
      let textBoxes = await driver.findElements(By.css('input[type="text"][name^="pin["][name$="]"]'));
      for(let textBox of textBoxes) {
          let name = await textBox.getAttribute("name");
          let position = parseInt(name.substring(4, name.length - 1)) ;
          let digit = F2ACode.charAt(position);
          await textBox.sendKeys(digit);
      }


      console.debug("Waiting for redirection to finish");
      await driver.sleep(5000);

      console.debug("Login should be complete");

      let homeButton = await findElementWithText(driver, "span.dl-desktop-navbar-link", "Accueil");
      if ( homeButton === undefined || homeButton.length == 0 ) {
          console.error("Home button not found, login probably failed");
          return 1;
      }
      console.debug("Home button found, login successful");
      await homeButton[0].click();

    } // END OF BYPASS_AUTH


    let searchBarInput = await driver.findElement(By.css('input.searchbar-input'));
    if ( options.doctor === undefined || options.doctor === "" ) {
      options.doctor = await askQuestion('Doctor name ? ');
    }
    await searchBarInput.sendKeys(options.doctor);

    let searchBarButton = await driver.findElement(By.css('button.searchbar-submit-button'));
    if ( searchBarButton === undefined ) {
        console.error("Search button not found");
        return 1;
    }

    console.debug("Clicking on search button");
    await searchBarButton.click();

    let resultsCards = await driver.findElements(By.css('article.search-result-card'));
    if ( resultsCards === undefined || resultsCards.length == 0 ) {
        console.error("No search results found");
        return 1;
    }

    const doctors = [];
    for(let card of resultsCards) {
      let text = await card.getText();
      let textLines = text.split('\n');
      textLines.splice(1, 1);
      textLines.splice(4,2);
      doctors.push( {
        title: textLines.join(', '),
        element: card,
        selectDoctorButton: await(card.findElement(By.css("a.dl-p-doctor-result-link")))
      }); 
    }

    for(let i = 0; i < doctors.length; i++) {
      console.log( (i+1) + ": " + doctors[i].title);
    }
    
    const doctorIndex = await askQuestion('Which doctor ? (number) ');
    const index = parseInt(doctorIndex) - 1;
    if ( isNaN(index) || index < 0 || index >= doctors.length ) {
      console.error("Invalid doctor index");
      return 1;
    }

    console.log("Selecting doctor: " + doctors[index].title);
    await doctors[index].selectDoctorButton.click();


    await driver.sleep(5000);
    let buttons = await driver.findElements(By.css("a.dl-button-primary"));
    let bookButton = null;
    for(let button of buttons) {
      let text = await button.getText();
      if ( text.toLowerCase().includes("prendre rendez-vous") ) {
        bookButton = button;
        break;
      }
    }

    if ( bookButton === null ) {
      console.error("Book button not found");
      return 1;
    }
    
    console.debug("Clicking on book button");
    await bookButton.click(); 


    let arrivedAtTheEnd = false;
    let step = 1;
    do {
      let optionsSelection = await driver.findElements(By.css('li[data-design-system-component="List:Item"]'));
      if ( options["step" + step] !== undefined && options["step" + step].length > 0 ) {
        for(let optionSelection of optionsSelection) {
          let text = await optionSelection.getText();
          if ( text.toLowerCase().includes(options["step" + step].toLowerCase()) ) {
            console.debug("Selecting option: " + text);
            await optionSelection.click();
            await driver.sleep(500);
            break;
          }
        }
        step++;
      } else {
        let title = await (await driver.findElement(By.id("step-title"))).getText();
        title = title.split("\n")[0];
        console.log(title);
        for(let optionSelection of optionsSelection) {
          let text = await optionSelection.getText();
          console.log( (optionsSelection.indexOf(optionSelection) + 1) + ": " + text);
        }
        let optionIndex = await askQuestion('Which Option ? (number) ');
        const index = parseInt(optionIndex) - 1;
        if ( isNaN(index) || index < 0 || index >= optionsSelection.length ) {
          console.error("Invalid option.");
          return 1;
        } else {
          options["step" + step] = await optionsSelection[index].getText();
        }
      }

      arrivedAtTheEnd = (await driver.findElements(By.css('li[data-design-system-component="List:Item"]'))).length == 0;
    } while(!arrivedAtTheEnd);
    

    let mustStop = false;
    let mustConsiderLastOptions = false;
    do {

      if ( mustConsiderLastOptions ) {

        lastOptionsSelections = await driver.findElements(By.css('li[data-design-system-component="List:Item"]'));
        for(let lastOptionSelection of lastOptionsSelections) {
          let text = await lastOptionSelection.getText();
          if ( text.toLowerCase().includes(options["step" + (step - 1)].toLowerCase()) ) {
            console.log("Selecting option: " + text);
            await lastOptionSelection.click();
            await driver.sleep(500);
            break;
          }
        }
      }
      mustConsiderLastOptions = true;

      let results = await driver.findElement(By.css('[data-test="booking-funnel-container"]'));
      if ( results === undefined ) {
          console.error("No result found");
          return 1;
      }
      let noAvailableSlot = (await results.getText()).includes("malheureusement pas disponible");
      if ( !noAvailableSlot ) {
        mustStop = true;
      } else {
        let buttons = await driver.findElements(By.css('button.dl-button'));
        console.log("No available slot found, retrying in 1 second...");
        for(let button of buttons) {
          let text = await button.getText();
          if ( text.toLowerCase().includes("étape précédente") ) {
            await button.click();
            break;
          }
        }
        await driver.sleep(1000);
      }
      
    } while(!mustStop);
  

    let firstSlotAvailableButton = await driver.findElement(By.css('[data-test="booking-funnel-container"] > div.dl-availabilities-card li.availabilities-slot-button'));
    if ( firstSlotAvailableButton === undefined ) {
        console.error("No slot button found");
        return 1;
    }
    console.debug("Clicking on first available slot button");
    await firstSlotAvailableButton.click();

    let confirmButton = await findElementWithText(driver, "button:has( > span)", "j'ai lu et j'accepte les consignes");
    if ( confirmButton === undefined || confirmButton.length == 0 ) {
        console.error("Confirm button not found");
        return 1;
    }
    console.debug("Clicking on confirm button");
    await confirmButton[0].click();


    confirmButton = await findElementWithText(driver, "button:has( > span)", "confirmer le rendez-vous");

    console.info("Booking should be complete");
  } catch (e) {
    console.error(e)
  } finally {
    await driver.quit();
  }
}())
