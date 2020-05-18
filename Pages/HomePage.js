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

    this.clickHome = function(resultdir) {
        linkHome.isPresent().then(function(exist) {
            base.click(linkHome);
            console.log("Successful : Clicked on Home");
            browser.sleep(1000);
            Report.udpateResult(resultdir,"Click on Home", "Successful", "Pass");
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
                expect(expectedTitle).toBe('GitHub - angular/protractor: E2E test framework for Angular apps');
                Report.udpateResult(resultdir,"GitHub - angular/protractor Displayed", "Successful", "Pass");
                browser.sleep(2000);
            });
            browser.navigate().back();
        });
    }
    this.navigateToSetUp = function(resultdir) {
        browser.executeScript("arguments[0].scrollIntoView();",SetUp);
        wait.waitTillElementPresent(SetUp);
        SetUp.isDisplayed().then(function(exist){
            console.log("Successful : SetUp Displayed");
            Report.udpateResult(resultdir,"SetUp Displayed", "Successful", "Pass");
            browser.sleep(1000);
        });
    }
    this.navigateToWriteTest = function(resultdir) {
        browser.executeScript("arguments[0].scrollIntoView();",WriteTest);
        wait.waitTillElementPresent(WriteTest);
        WriteTest.isDisplayed().then(function(exist){
            console.log("Successful : Write Test Displayed");
            Report.udpateResult(resultdir,"Write Test Displayed", "Successful", "Pass");
            browser.sleep(1000);
        });
    }
    this.navigateToConfiguration = function(resultdir) {
        browser.executeScript("arguments[0].scrollIntoView();",Configuration);
        wait.waitTillElementPresent(Configuration);
        Configuration.isDisplayed().then(function(exist){
            console.log("Successful : Configuration Displayed");
            Report.udpateResult(resultdir,"Configuration Displayed", "Successful", "Pass");
            browser.sleep(1000);
        });
    }
    this.navigateToRunthetest = function(resultdir) {
        browser.executeScript("arguments[0].scrollIntoView();",RunTheTest);
        wait.waitTillElementPresent(RunTheTest);
        RunTheTest.isDisplayed().then(function(exist){
            console.log("Successful : Run Test Displayed");
            Report.udpateResult(resultdir,"Run Test Displayed", "Successful", "Pass");
            browser.sleep(1000);
        });
    }
    this.navigateToTutorial = function(resultdir) {
        browser.executeScript("arguments[0].scrollIntoView();",lnkTutorial);
        wait.waitTillElementPresent(lnkTutorial);
        lnkTutorial.isDisplayed().then(function(exist){
            base.click(lnkTutorial);
            console.log("Successful : Clicked on Tutorial");
            Report.udpateResult(resultdir,"Clicked on tutorial link", "Successful", "Done")
            browser.sleep(2000);
            Tutorial.isPresent().then(function(exist) {
                expect(exist).toBeTruthy();
                Report.udpateResult(resultdir,"Tutorial Page Displayed", "Successful", "Pass");
            });
        });
    }    
};

module.exports = HomePage