//Either use .then(function(fnName) { or .then(fnName) => { , both will work
//function() ~ ()=>

/**
Author: Aditya Roy
**/

//Importing modules
var testSetUp = require("../Test Environment/Environment.js");

//Define elements locators
var ddl_ProtractorSetup = element(by.xpath("//*[contains(text(),'Protractor Setup')]"));
var choseFramework = element(by.xpath("//*[contains(text(),'Choosing a Framework')]"));

//Test Functionality check
describe('Testing the loading functionality', function() {

        var Environment = new testSetUp();
        it('Should be able to load the Page', () => {
            browser.getCurrentUrl().then((url) => {
                expect(url).toContain('https://www.protractortest.org');
            });
            console.log("Successfull : Navigated to https://www.protractortest.org");
            browser.getTitle().then(function(expectedTitle) {
                            expect(expectedTitle).toBe('Protractor - end-to-end testing for AngularJS');
                            //global.paymentID = "FX000153";
            });
            console.log("Successfull : Validated Title: Protractor - end-to-end testing for AngularJS");
        });

        it('Should be able to choose framework option from Protractor Set up', function() {
            browser.wait(protractor.ExpectedConditions.elementToBeClickable(ddl_ProtractorSetup), 10000).then ( function () {
                ddl_ProtractorSetup.click();
                console.log("Successfull : Clicked on Protractor SetUp");
                browser.sleep(2000);
                element(by.cssContainingText("a","Setting Up the Browser")).click();
                //element(by.xpath("//ul[@class='dropdown-menu']")).$("li").element(by.cssContainingText("a","Setting Up the Browser")).click();
                browser.sleep(2000);
                console.log("Successfull : Navigated Setting Up the Browser");
                ddl_ProtractorSetup.click();
                choseFramework.click();
                console.log("Successfull : Navigated Choosing a Framework");
                //console.log(paymentID);
            });
        });
});


