/**
 * Copyright : Aditya Roy
 */

var reportPath = require('../Report/GenerateReport.js');
var baseClass = require('../BaseClass/BaseClass.js');
var waitPage = require("../Wait/Wait.js");

var TutorialPage = function()
{
    var Report = new reportPath();
    var base = new baseClass();
    var wait = new waitPage();

    var linkNodeJS = element(by.xpath('//a[text()="Node.js"]'));
    var linkTableofContent = element(by.xpath('//a[text()="Table of Contents"]'));
    var WriteTest = element(by.xpath("//div[contains(text(),'Step 0 - write a test')]"));
    var ElementInteract = element(by.xpath("//div[contains(text(),'Step 1 - interacting with elements')]"));
    var WhereToGo = element(by.xpath("//div[contains(text(),'Where to go next')]"));
    var TableofContent = element(by.xpath("//h1[@id='table-of-contents']"));

    this.validateNodeJSLink = function(resultdir) {
        linkNodeJS.isPresent().then(function(exist) {
            base.click(linkNodeJS);
            console.log("Successful : Clicked on Node.JS");
            Report.udpateResult(resultdir,"Click on Node.Js", "Successful", "Done");
            browser.sleep(2000);
            browser.waitForAngularEnabled(false);
            browser.getTitle().then(function(expectedTitle) {
                expect(expectedTitle).toBe("Node.js");
                Report.udpateResult(resultdir,"Node.js Displayed", "Successful", "Pass");
                browser.sleep(2000);
            });
            browser.navigate().back();
        },
        function(err) {
            console.error("Unsuccessful : Node.js Link Not Displayed");
            Report.udpateResult(resultdir,"Node.js Link Not Displayed", "Unsuccessful", "Fail");
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
    this.navigateToElementInteract = function(resultdir) {
        ElementInteract.isDisplayed().then(function(exist){
            browser.executeScript("arguments[0].scrollIntoView();",ElementInteract);
            wait.waitTillElementPresent(ElementInteract);
            console.log("Successful : Interacting with elements Displayed");
            Report.udpateResult(resultdir,"Interacting with elements Displayed", "Successful", "Pass");
            browser.sleep(1000);
        },
        function(err) {
            console.error("Unsuccessful : Interacting with elements section Not Displayed");
            Report.udpateResult(resultdir,"Interacting with elements section Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.navigateWhereToGo = function(resultdir) {
        WhereToGo.isDisplayed().then(function(exist){
            browser.executeScript("arguments[0].scrollIntoView();",WhereToGo);
            wait.waitTillElementPresent(WhereToGo);
            console.log("Successful : WhereToGo Displayed");
            Report.udpateResult(resultdir,"Where To Go Displayed", "Successful", "Pass");
            browser.sleep(1000);
        },
        function(err) {
            console.error("Unsuccessful : Where To Go section Not Displayed");
            Report.udpateResult(resultdir,"Where To Go section Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.navigateToTableofContent = function(resultdir) {
        linkTableofContent.isDisplayed().then(function(exist){
            base.click(linkTableofContent);
            console.log("Successful : Clicked on Table of Content");
            Report.udpateResult(resultdir,"Clicked on Table of Content link", "Successful", "Done")
            browser.sleep(2000);
            TableofContent.isPresent().then(function(exist) {
                expect(exist).toBeTruthy();
                Report.udpateResult(resultdir,"Table of Content Page Displayed", "Successful", "Pass");
            });
        },
        function(err) {
            console.error("Unsuccessful : Table of Content link is not present");
            Report.udpateResult(resultdir,"Table of Content link not present", "Unsuccessful", "Fail");
        }); 
    }    
};

module.exports = TutorialPage