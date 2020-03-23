/**
Author: Aditya Roy
**/

/**Importing modules**/
var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");
var mm = require('moment-precise-range-plugin');
var starttime = moment(new Date(),"MM-DD-YYYY HH:mm:ss");

/**Defining the function**/
var EnvironmentSetUp = function(){

            //execute only once before all under describe
            beforeAll(() => {
                console.log(moment().format("MM-DD-YYYY HH:mm:ss")+" Test Execution Started");
                console.log("****************************************************************************");
                browser.waitForAngularEnabled(true);
                console.log("Set waitForAngularEnabled = true");
                browser.ignoreSynchronization = false;
                console.log("Set ignoreSynchronization = false");
                browser.get('https://www.protractortest.org/');
                console.log("Navigated to https://www.protractortest.org/");
            });
            beforeEach(() => {
                browser.navigate().refresh();
                console.log("Refreshing the browser content");
                console.log("Test Method Execution Started at : "+moment().format("MM-DD-YYYY HH:mm:ss"));
                console.log("---------------------------------------------------------------------------")
            });
           afterEach(() => {
                console.log("---------------------------------------------------------------------------");
                console.log("Test Method Execution Completed at : "+moment().format("MM-DD-YYYY HH:mm:ss"));
            });
            afterAll(() => {
                var endtime = moment(new Date(),"MM-DD-YYYY HH:mm:ss");
                var duration = moment.duration(moment(endtime).diff(starttime));
                //console.log(duration.humanize());
                console.log("****************************************************************************");
                console.log("Total Duration : "+duration.minutes()+" minutes "+duration.seconds()+" seconds");
                console.log(moment().format("MM-DD-YYYY HH:mm:ss")+" Test Execution Completed");
            });

};

/**exporting it**/
module.exports = EnvironmentSetUp