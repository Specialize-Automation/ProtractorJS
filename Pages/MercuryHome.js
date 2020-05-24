/**
 * Copyright : Aditya Roy
 */

var reportPath = require('../Report/GenerateReport.js');
var baseClass = require('../BaseClass/BaseClass.js');
var waitPage = require("../Wait/Wait.js");

var MercuryHome = function()
{
    var Report = new reportPath();
    var base = new baseClass();
    var wait = new waitPage();

    var linkHome = element(by.xpath('//a[text()="Home"]'));
    var linkRegister = element(by.xpath('//a[text()="REGISTER"]'));
    var txtFirstName = element(by.xpath('//input[@name="firstName"]'));
    var txtLastName = element(by.xpath('//input[@name="lastName"]'));
    var txtPhone = element(by.xpath('//input[@name="phone"]'));
    var txtEmail = element(by.xpath('//input[@name="userName"]'));
    var txtCity = element(by.xpath('//input[@name="city"]'));
    var ddlCountry = element(by.xpath('//select[@name="country"]'));
    var txtUserName = element(by.xpath('//input[@name="email"]'));
    var txtPassword = element(by.xpath('//input[@name="password"]'));
    var txtConfirmPassword = element(by.xpath('//input[@name="confirmPassword"]'));
    var btnSubmit = element(by.xpath('//input[@name="register"]'));
    var msgConfirmRegistn = element(by.xpath('//font[contains(text(),"Thank you for registering")]'));

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
    this.navigateToRegistration = function(resultdir) {
        linkRegister.isPresent().then(function(exist) {
            base.click(linkRegister);
            console.log("Successful : Clicked on Register");
            Report.udpateResult(resultdir,"Click on Register", "Successful", "Done");
            browser.sleep(2000);
            browser.waitForAngularEnabled(false);
            browser.getTitle().then(function(expectedTitle) {
                expect(expectedTitle).toBe(browser.params.MurcuryApp.RegistrationTitle);
                Report.udpateResult(resultdir,browser.params.MurcuryApp.RegistrationTitle+" Displayed", "Successful", "Pass");
                browser.sleep(2000);
            });
        },
        function(err) {
            console.error("Unsuccessful : Register Link Not Displayed");
            Report.udpateResult(resultdir,"Register Link Not Displayed", "Unsuccessful", "Fail");
        });
    }  
    this.updateUserDetails = function(FirstName, LastName, Phone, Email, City, Country, Username, Password, resultdir) {
        txtFirstName.isDisplayed().then(function(exist) {
            base.enterText(txtFirstName,FirstName);
            console.log("Successful : Updated Firstname :"+FirstName);
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated Firstname :"+FirstName, "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"FirstName not available", "Unsuccessful", "Fail");
        });
        txtLastName.isDisplayed().then(function(exist) {
            base.enterText(txtLastName,LastName);
            console.log("Successful : Updated LastName :"+LastName);
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated LastName :"+LastName, "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"LastName not available", "Unsuccessful", "Fail");
        });
        txtPhone.isDisplayed().then(function(exist) {
            base.enterText(txtPhone,Phone);
            console.log("Successful : Updated Phone :"+Phone);
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated Phone :"+Phone, "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"Phone not available", "Unsuccessful", "Fail");
        });
        txtEmail.isDisplayed().then(function(exist) {
            base.enterText(txtEmail,Email);
            console.log("Successful : Updated Email :"+Email);
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated Email :"+Email, "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"Email not available", "Unsuccessful", "Fail");
        });
        txtCity.isDisplayed().then(function(exist) {
            base.enterText(txtCity,City);
            console.log("Successful : Updated City :"+City);
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated City :"+City, "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"City not available", "Unsuccessful", "Fail");
        });
        ddlCountry.isDisplayed().then(function(exist) {
            base.click(ddlCountry);
            base.click(element(by.cssContainingText('option',Country)));
            console.log("Successful : Updated Country :"+Country);
            browser.sleep(1500);
            Report.udpateResult(resultdir,"Updated Country :"+Country, "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"Country not available", "Unsuccessful", "Fail");
        });
        txtUserName.isDisplayed().then(function(exist) {
            base.enterText(txtUserName,Username);
            console.log("Successful : Updated Username :"+Username);
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated Username :"+Username, "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"Username not available", "Unsuccessful", "Fail");
        });
        txtPassword.isDisplayed().then(function(exist) {
            base.enterText(txtPassword,Password);
            console.log("Successful : Updated Password : XXXXXXX");
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated Password : XXXXXXX", "Successful", "Done");
        },
        function(err) {
            Report.udpateResult(resultdir,"Password not available", "Unsuccessful", "Fail");
        });
        txtConfirmPassword.isDisplayed().then(function(exist) {
            base.enterText(txtConfirmPassword,Password);
            console.log("Successful : Updated Password : XXXXXXX");
            browser.sleep(250);
            Report.udpateResult(resultdir,"Updated Confirm Pasword : XXXXXXX", "Successful", "Done");
            Report.udpateResult(resultdir,"Updated User Details", "Successful", "Pass");
        },
        function(err) {
            Report.udpateResult(resultdir,"Confirm Password not available", "Unsuccessful", "Fail");
        });
    }
    this.clickSubmit = function(resultdir) {
        btnSubmit.isDisplayed().then(function(exist) {
            base.click(btnSubmit);
            console.log("Successful : Clicked on Submit");
            browser.sleep(1000);
            Report.udpateResult(resultdir,"Click on Submit", "Successful", "Pass");
        },
        function(err) {
            console.error("Unsuccessful : Submit Button Not Displayed");
            Report.udpateResult(resultdir,"Submit Button Not Displayed", "Unsuccessful", "Fail");
        });
    }
    this.validateRegistrationConfirmation = function(resultdir) {
        msgConfirmRegistn.isDisplayed().then(function(exist) {
            console.log("Successful : User Registration Process");
            Report.udpateResult(resultdir,"Registration process", "Successful", "Pass");
            browser.sleep(500);
        },
        function(err) {
            console.log("Unsuccessful : User Registration Process");
            Report.udpateResult(resultdir,"User Registration Process", "Unsuccessful", "Fail");
        });
        base.getElementText(msgConfirmRegistn).then(function(message) {
            console.log(message);
        });
    }
    
};

module.exports = MercuryHome