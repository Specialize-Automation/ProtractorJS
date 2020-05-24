//importing protractor beautiful report
//var HtmlReporter = require('protractor-beautiful-reporter');

var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");
var mm = require('moment-precise-range-plugin');
//var starttime = moment().format("MM-DD-YYYY HH:mm:ss");
var starttime = moment(new Date(),"MM-DD-YYYY HH:mm:ss");


exports.config = {
    //set direct connect as true, if you want to direct connect to browser and automate without setting selenium server
    directConnect:'true',
    //troubleshoot: true,
    //SeleniumAddress: 'http://localhost:4444/wd/hub'

    //capabilities to be passed
    capabilities: {
        platform: 'windows',
        platformVersion: '10',
        browserName: 'chrome',
        chromeOptions: {
            binary: 'C:/Users/Laptop/AppData/Local/Google/Chrome/Application/chrome.exe',
            'args': ['show-fps-counter=true'],
            'args': ['disable-extensions', 'start-maximized', '--disable-web-security','--no-sandbox'],
            'args': ['disable-infobars'],
            useAutomationExtension: false
            }

    },
    chromeDriver: '../node_modules/webdriver-manager/selenium/chromedriver.exe',
    framework: 'jasmine',
    specs:['../TestScript/TC03*'],
    params: require('../TestData/CommonData.json'),
    allScriptsTimeout: 20000,

     //this onPrepare function is for generate report
     onPrepare: function() {
        browser.waitForAngularEnabled(false);
        browser.ignoreSynchronization = true;

            /* beforeAll(() => {

                    console.log(starttime+" Test Execution Started");
                    console.log("********************************************************************");
                    browser.waitForAngularEnabled(true);
                    console.log("Set waitForAngularEnabled = true");
                    browser.ignoreSynchronization = false;
                    console.log("Set ignoreSynchronization = false");
                    browser.get('https://www.protractortest.org/');
                    console.log("Navigated to https://www.protractortest.org/");
                });

             beforeEach(() => {
                   //browser.navigate().refresh();
                    console.log("Refreshing the browser content");
                    console.log("-------------------------------")
                });
             afterEach(() => {
                     console.log("Test Method Execution Completed")
                     console.log("-------------------------------")
                 });

             afterAll(() => {
                     //var endtime = (moment().format("MM-DD-YYYY HH:mm:ss"));
                     var endtime = moment(new Date(),"MM-DD-YYYY HH:mm:ss");
                     var duration = moment.duration(moment(endtime).diff(starttime));
                     //console.log(duration.humanize());
                     console.log("Total Duration : "+duration.minutes()+" minutes "+duration.seconds()+" seconds");

                     console.log("********************************************************************");
                     console.log(endtime+" Test Execution Completed");
                 });*/


           //importing protractor beautiful report
           var HtmlReporter = require('protractor-beautiful-reporter');
           browser.driver.manage().window().maximize();

           /*if page not angular waitForAng = false, and ignoreSync= true else angular couldn't be found error thrown
           usually call this before getURL or loading the URL, normally login page not angular in nature and same can be checked in browser dev
           console if types "angular" will throw Uncaught ReferenceError: angular is not defined*/

           //browser.waitForAngularEnabled(false);
           //browser.ignoreSynchronization = true;


          // Add a screenshot reporter and store screenshots to location:
          jasmine.getEnv().addReporter(new HtmlReporter({
             baseDirectory: '../temp/Screenshots'
          }).getJasmine2Reporter());
       },


    jasmineNodeOpts: {
        showColors: true,
        defaultTimeoutInterval: 200000,
    }
};
