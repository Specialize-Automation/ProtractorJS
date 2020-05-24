//Either use .then(function(fnName) { or .then(fnName) => { , both will work
//function() ~ ()=>

/**
Author: Aditya Roy
**/

//Importing modules
var testSetUp = require("../Test Environment/Environment.js");
var reportPath = require("../Report/GenerateReport.js");
var home = require("../Pages/MercuryHome.js");
var dateFormat = require('dateformat');
var testdata = require("../TestData/TestData.json");
var using = require('jasmine-data-provider');


var path = require('path');
var scriptName = path.basename(__filename).replace('.js','');
var timeStamp = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss").replace(' ','-').replace(':','_').replace(':','_');
var fs = require('fs');
var resultPath = 'C:/ProtractorAutomation/Result/Result_'+ scriptName + "_" + timeStamp;
var Report = new reportPath();
Report.CreateResultsFile(resultPath);

//Test Functionality check
describe('Registration flow E2E', function() {
var Environment = new testSetUp();

    using(testdata, function(inputData) {
        it('To validate and check registration flow of user', function() {

            Report.updateTest(resultPath, scriptName, "Validate Home Page Details");

            var homePage = new home();
                homePage.validateApplication(browser.params.MurcuryApp.AppName,resultPath);
                homePage.clickHome(resultPath);
                homePage.navigateToRegistration(resultPath);
                homePage.updateUserDetails(inputData.TC03.FirstName,
                                           inputData.TC03.LastName,
                                           inputData.TC03.Phone,
                                           inputData.TC03.Email,
                                           inputData.TC03.City,
                                           inputData.TC03.Country,
                                           inputData.TC03.UserName,
                                           inputData.TC03.Password,
                                           resultPath);
                homePage.clickSubmit(resultPath);
                homePage.validateRegistrationConfirmation(resultPath);

            Report.updateDuration(resultPath);
        });
    });
});


