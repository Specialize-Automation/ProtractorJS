/**
 * Copyright : Aditya Roy
 */

var reportPath = require('../Report/GenerateReport.js');
var baseClass = require('../BaseClass/BaseClass.js');
var waitPage = require("../Wait/Wait.js");

var HomePage = function()
{
    var Report = new reportPath();
    var base = new baseClass();
    var wait = new waitPage();

    var linkHome = element(by.xpath('//a[text()="Home"]'));
    var linkGithub = element(by.xpath('//a[@href="https://github.com/angular/protractor"]'));
    var SetUp = element(by.xpath("//h2[contains(text(),'Setup')]"));
    var WriteTest = element(by.xpath("//h2[contains(text(),'Write a test')]"));
    var Configuration = element(by.xpath("//h2[contains(text(),'Configuration')]"));
    var RunTheTest = element(by.xpath("//h2[contains(text(),'Run the test')]"));
    var lnkTutorial = element.all(by.xpath("//a[contains(@href,'tutorial')]")).get(2);
    var Tutorial = element(by.xpath("//h1[text()='Tutorial']"));
    
    // var ddl_ProtractorSetup = element(by.xpath("//*[contains(text(),'Protractor Setup')]"));
    // var chooseFramework = element(by.xpath("//*[contains(text(),'Choosing a Framework')]"));

    this.validateApplication = function(appName,resultdir) {
        browser.getTitle().then(function(expectedTitle) {
            expect(expectedTitle).toBe(appName);
            console.log("Successful : Application Loaded");
            Report.udpateResult(resultdir,"Navigate to "+appName, "Successful", "Pass");
            browser.sleep(500);
        },
        function(err) {
            console.log("Unsuccessful : Application Not Loaded");
            Report.udpateResult(resultdir,"Application Not loaded", "Unsuccessful", "Fail");
        });
    }
    this.clickHome = function(resultdir) {
        linkHome.isDisplayed().then(function(exist) {
            base.click(linkHome);
            console.log("Successful : Clicked on Home");
            browser.sleep(1000);
            Report.udpateResult(resultdir,"Click on Home", "Successful", "Pass");
        },
        function(err) {
            console.error("Unsuccessful : Home Link Not Displayed");
            Report.udpateResult(resultdir,"Home Link Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.validateGitHubLink = function(resultdir) {
        linkGithub.isPresent().then(function(exist) {
            base.click(linkGithub);
            console.log("Successful : Clicked on Github");
            Report.udpateResult(resultdir,"Click on ChooseFramework", "Successful", "Done");
            browser.sleep(2000);
            browser.waitForAngularEnabled(false);
            browser.getTitle().then(function(expectedTitle) {
                expect(expectedTitle).toBe(browser.params.App.GitHub);
                Report.udpateResult(resultdir,"GitHub - angular/protractor Displayed", "Successful", "Pass");
                browser.sleep(2000);
            });
            browser.navigate().back();
        },
        function(err) {
            console.error("Unsuccessful : GitHub Link Not Displayed");
            Report.udpateResult(resultdir,"GitHub Link Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.navigateToSetUp = function(resultdir) {
        SetUp.isDisplayed().then(function(exist){
            browser.executeScript("arguments[0].scrollIntoView();",SetUp);
            wait.waitTillElementPresent(SetUp);
            console.log("Successful : SetUp Displayed");
            Report.udpateResult(resultdir,"SetUp Displayed", "Successful", "Pass");
            browser.sleep(1000);
        },
        function(err) {
            console.error("Unsuccessful : Set Up section Not Displayed");
            Report.udpateResult(resultdir,"Set Up section Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.navigateToWriteTest = function(resultdir) {
        WriteTest.isDisplayed().then(function(exist){
            browser.executeScript("arguments[0].scrollIntoView();",WriteTest);
            wait.waitTillElementPresent(WriteTest);
            console.log("Successful : Write Test Displayed");
            Report.udpateResult(resultdir,"Write Test Displayed", "Successful", "Pass");
            browser.sleep(1000);
        },
        function(err) {
            console.error("Unsuccessful : Write Test Section Not Displayed");
            Report.udpateResult(resultdir,"Wrtite Test Section Not Displayed", "Unsuccessful", "Fail");
        }); 
    }
    this.navigateToConfiguration = function(resultdir) {
        Configuration.isDisplayed().then(function(exist){
            browser.executeScript("arguments[0].scrollIntoView();",Configuration);
            wait.waitTillElementPresent(Configuration);
            console.log("Successful : Configuration Displayed");
            Report.udpateResult(resultdir,"Configuration Displayed", "Successful", "Pass");
            browser.sleep(1000);
        },
        function(err) {
            console.error("Unsuccessful : Configuration section Not Displayed");
            Report.udpateResult(resultdir,"Configuration section Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.navigateToRunthetest = function(resultdir) {
        RunTheTest.isDisplayed().then(function(exist){
            browser.executeScript("arguments[0].scrollIntoView();",RunTheTest);
            wait.waitTillElementPresent(RunTheTest);
            console.log("Successful : Run Test Displayed");
            Report.udpateResult(resultdir,"Run Test Displayed", "Successful", "Pass");
            browser.sleep(1000);
        },
        function(err) {
            console.error("Unsuccessful : Run The Test section Not Displayed");
            Report.udpateResult(resultdir,"Run The Test section Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.navigateToTutorial = function(resultdir) {
        lnkTutorial.isDisplayed().then(function(exist){
            browser.executeScript("arguments[0].scrollIntoView();",lnkTutorial);
            wait.waitTillElementPresent(lnkTutorial);
            base.click(lnkTutorial);
            console.log("Successful : Clicked on Tutorial");
            Report.udpateResult(resultdir,"Clicked on tutorial link", "Successful", "Done")
            browser.sleep(2000);
            Tutorial.isPresent().then(function(exist) {
                expect(exist).toBeTruthy();
                Report.udpateResult(resultdir,"Tutorial Page Displayed", "Successful", "Pass");
            });
        },
        function(err) {
            console.error("Unsuccessful : Tutorial Link Not Displayed");
            Report.udpateResult(resultdir,"Tutorial Link Not Displayed", "Unsuccessful", "Fail");
        }); 
    }    
};

module.exports = HomePage