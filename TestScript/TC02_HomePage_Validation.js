//Either use .then(function(fnName) { or .then(fnName) => { , both will work
//function() ~ ()=>

/**
Author: Aditya Roy
**/

//Importing modules
var testSetUp = require("../Test Environment/Environment.js");
var reportPath = require("../Report/GenerateReport.js");
var home = require("../Pages/HomePage.js");
var dateFormat = require('dateformat');



var path = require('path');
var scriptName = path.basename(__filename).replace('.js','');
var timeStamp = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss").replace(' ','-').replace(':','_').replace(':','_');
var fs = require('fs');
var resultPath = 'C:/ProtractorAutomation/Result/Result_'+ scriptName + "_" + timeStamp;
var Report = new reportPath();
Report.CreateResultsFile(resultPath);

//Test Functionality check
describe('Testing the loading functionality', function() {

    var Environment = new testSetUp();
    it('Validate Home Page Details', function() {
        
        Report.updateTest(resultPath, scriptName, "Validate Home Page Details");

        var homePage = new home();

            homePage.clickHome(resultPath);
            homePage.validateGitHubLink(resultPath);
            homePage.navigateToSetUp(resultPath);
            homePage.navigateToWriteTest(resultPath);
            homePage.navigateToConfiguration(resultPath);
            homePage.navigateToRunthetest(resultPath);
            homePage.navigateToTutorial(resultPath);

        Report.updateDuration(resultPath);
    });
});


