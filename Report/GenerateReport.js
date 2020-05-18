/**
 * Designed By :  Aditya Roy
 */

 //Importing packages
 var dateFormat = require('dateformat');
 var moment = require('moment');
 var fs = require('fs');
 var os = require('os')
 var ip = require("ip");
 var GenerateReport = function() {

//declaring variables
 var j = 0;
 var stepnumber = 0;
 var startTime = moment(new Date(),"MM-DD-YYYY HH:mm:ss");
    
    //CreateResultFile() to create the directory and update all the necessary details in the HTML
    this.CreateResultsFile = function(resultdir){
        if(!fs.existsSync(resultdir)){
            fs.mkdirSync(resultdir);
            console.log("Created Result Directory "+resultdir);
        }
        var screenshotdir = resultdir + "/screenshots";
        if(!fs.existsSync(screenshotdir))
        {
            fs.mkdirSync(screenshotdir);
        }

        fs.createReadStream('../Report/resultformat.html').pipe(fs.createWriteStream(resultdir + '/ScriptResult.html'));
        fs.createReadStream('../Report/content.jpg').pipe(fs.createWriteStream(resultdir + '/content.jpg'));
        fs.createReadStream('../Report/background.jpg').pipe(fs.createWriteStream(resultdir + '/background.jpg'));
        // fs.readFile(resultdir + '/ScriptResult.html', 'utf8', function(err,data) {
        //     if(err)
        //     {
        //         return console.log(err);
        //     }
        //     var result = data.replace(/ScriptTime/g, dateFormat(new Date(), "hh:MM:ss"));
        //     fs.writeFileSync(resultdir + '/ScriptResult.html', result, 'utf8', function(err)
        //     {
        //         if(err)
        //         {
        //             return console.log(err);
        //         }
        //     });
        // });
        // fs.readFile(resultdir + '/ScriptResult.html', 'utf8', function(err,data) {
        //     if(err)
        //     {
        //         return console.log(err);
        //     }
        //     var result = data.replace(/ScriptTime/g, dateFormat(new Date(), "hh-mm-ss"));
        //     fs.writeFileSync(resultdir + '/ScriptResult.html', result, 'utf8', function(err)
        //     {
        //         if(err)
        //         {
        //             return console.log(err);
        //         }
        //     });
        // });
        // fs.readFile(resultdir + '/ScriptResult.html', 'utf8', function(err,data) {
        //     if(err)
        //     {
        //         return console.log(err);
        //     }
        //     var result = data.replace(/ScriptDate/g, dateFormat(new Date(), "yyyy-mm-dd"));
        //     fs.writeFileSync(resultdir + '/ScriptResult.html', result, 'utf8', function(err)
        //     {
        //         if(err)
        //         {
        //             return console.log(err);
        //         }
        //     });
        // });
        // fs.readFile(resultdir + '/ScriptResult.html', 'utf8', function(err,data) {
        //     if(err)
        //     {
        //         return console.log(err);
        //     }
        //     var result = data.replace(/TestName/g, ScriptName);
        //     fs.writeFileSync(resultdir + '/ScriptResult.html', result, 'utf8', function(err)
        //     {
        //         if(err)
        //         {
        //             return console.log(err);
        //         }
        //     });
        // });
    }
    //UpdateTest() to update the result with test name and iteration
    this.updateTest = function(resultdir, ScriptName, iteration){
        fs.appendFileSync(resultdir + '/ScriptResult.html', "<tbody><tr class='section'><span id=\'testScriptName\'>" + ScriptName + "</span></td></tr></tbody>", function(err){
            if(err) throw err;
            console.log('Saved !');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html', "<tbody><tr class='section'><span id=\'createTest\'>" + iteration + "</span></td></tr></tbody>", function(err){
            if(err) throw err;
            console.log('Saved !');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html', "<tbody><tr class='section'><span id=\'executorID\'>" + os.userInfo().username + "</span></td></tr></tbody>", function(err){
            if(err) throw err;
            console.log('Saved !');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html', "<tbody><tr class='section'><span id=\'user_OS_IP\'>" + os.type().substring(0,6)+os.release().substring(0,2)+"/"+ip.address()+ "</span></td></tr></tbody>", function(err){
            if(err) throw err;
            console.log('Saved !');
        });
        // console.log("Executor ID : "+os.userInfo().username);
        // console.log("System HostName : "+os.hostname());
        // console.log("OS Type & Release :"+os.type()+"/"+os.release());
        // console.log("IP Address :"+ip.address());
    }
    function writeScreenShot(resultdir, data, fileName){
        var stream = fs.createWriteStream(resultdir + "/screenshots" + "/" + fileName);
            stream.write(new Buffer(data, 'base64'));
            stream.end();
    }
    var passCounter = 0;
    var sum = 0;

    //updateResult() mehtod to use in test, to capture result, status and inline screenshots and append in html
    this.udpateResult = function(resultdir, stepName, stepDesc, stepStatus) {
        stepnumber = stepnumber + 1;
        j = stepnumber;

        browser.takeScreenshot().then(function(png){
            writeScreenShot(resultdir, png, 'step' + j +'.png');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html',"<tr class='content' id='Iteration1InvokeMFSession1'>", function(err) {
            if(err) throw err;
            console.log('Saved !');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html',"<td>" + j + "</td>", function(err) {
            if(err) throw err;
            console.log('Saved !');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html',"<td>" + stepName + "</td>", function(err) {
            if(err) throw err;
            console.log('Saved !');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html',"<td>" + stepDesc + "</td>", function(err)  {
            if(err) throw err;
            console.log('Saved !');
        });
        var pass = "PaSs";
        var fail = "FaIL";
        var done = "DoNe";
        var passCounter = 0;

        if(stepStatus.toUpperCase()==pass.toUpperCase())
        {
            // ++passCounter;
            // sum = sum+passCounter;
            // console.log(sum);
            fs.appendFileSync(resultdir + '/ScriptResult.html', "<td class='pass'><a style='color:#109015;' href='screenshots/"+'step' + j +'.png' + "'>" + stepStatus + "</a></td>", function (err) {
                if(err) throw err;
                console.log('Saved !');
            });                                   
        } 
        else if(stepStatus.toUpperCase()==done.toUpperCase())
        {
            fs.appendFileSync(resultdir + '/ScriptResult.html', "<td class='pass'><a style='color:#000000;'>" + stepStatus + "</a></td>", function (err) {
                if(err) throw err;
                console.log('Saved !');
            });  
        }else  if(stepStatus.toUpperCase()==fail.toUpperCase())
        {
            fs.appendFileSync(resultdir + '/ScriptResult.html', "<td class='pass'><a style='color:#ec0e0e;' href='screenshots/"+'step' + j +'.png' + "'>" + stepStatus + "</a></td>", function (err) {
                if(err) throw err;
                console.log('Saved !');
            });   
        }
        fs.appendFileSync(resultdir + '/ScriptResult.html', "<td>" + moment().format("MMMM DD YYYY, h:mm:ss:SSS a") + "</td>", function(err) {
            if(err) throw err;
            console.log('Saved !');
        });
        fs.appendFileSync(resultdir + '/ScriptResult.html', "</tr>" , function(err) {
            if(err) throw err;
            console.log('Saved !');
        });
    }
    //updateDuration() method to update the total time taken for E2E flow
    this.updateDuration = function(resultdir) {
        browser.getTitle().then(function (isThere) {
            var endTime = moment(new Date(),"MM-DD-YYYY HH:mm:ss");
            var timeDuration = moment(endTime).diff(moment(startTime));
            var d = moment.duration(timeDuration);

            fs.appendFileSync(resultdir + '/ScriptResult.html',"<tbody><tr class='section'><span id=\'durationHour\'>"+ d.hours() + "</span></td></tr></tbody>", function(err) {
                if(err) throw err;
                console.log('Saved !');
            });
            fs.appendFileSync(resultdir + '/ScriptResult.html',"<tbody><tr class='section'><span id=\'durationMin\'>"+ d.minutes() + "</span></td></tr></tbody>", function(err) {
                if(err) throw err;
                console.log('Saved !');
            });
            fs.appendFileSync(resultdir + '/ScriptResult.html',"<tbody><tr class='section'><span id=\'durationSec\'>"+ d.seconds() + "</span></td></tr></tbody>", function(err) {
                if(err) throw err;
                console.log('Saved !');
            });
            console.log("Total Duration Hours : Minutes : Second :"+ d.hours() + ":" + d.minutes() + ":" + d.seconds());
        });
    }

 };

 module.exports = GenerateReport