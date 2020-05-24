/**
Author: Aditya Roy
**/

/**Importing modules**/
var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");
var mm = require('moment-precise-range-plugin');
var starttime = moment(new Date(),"MM-DD-YYYY HH:mm:ss");
var os = require('os')
var ip = require("ip");


/**Defining the function**/
var EnvironmentSetUp = function(){

            //execute only once before all under describe
            beforeAll(() => {
                console.log(moment().format("MM-DD-YYYY HH:mm:ss")+" Test Execution Started");
                console.log("****************************************************************************");
                console.log('---------------------------------------------');
                console.log("Executor ID : "+os.userInfo().username+"		    	    |");
                console.log("System HostName : "+os.hostname()+"           |");
                console.log("OS Type & Release :"+os.type()+"/"+os.release()+"    |");
                console.log("IP Address :"+ip.address()+"                   |");
                console.log('---------------------------------------------');
                browser.waitForAngularEnabled(false);
                console.log("Set waitForAngularEnabled = false");
                browser.ignoreSynchronization = true;
                console.log("Set ignoreSynchronization = true");
                browser.get(browser.params.MurcuryApp.URL);
                console.log("Navigated to "+browser.params.MurcuryApp.URL);
                
            });
            beforeEach(() => {
                browser.navigate().refresh();
                console.log("Test Method Execution Started at : "+moment().format("MM-DD-YYYY HH:mm:ss"));
                console.log("---------------------------------------------------------------------------")
                console.log("Refreshing the browser content");
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