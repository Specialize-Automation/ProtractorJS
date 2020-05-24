var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11108,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.113"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f0071-00c8-0091-003b-00b7006e0001.png",
        "timestamp": 1587925380500,
        "duration": 2387
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11108,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.113"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009500d8-0042-00d0-00a1-0085005a008a.png",
        "timestamp": 1587925384091,
        "duration": 7065
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4020,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00270029-00b3-001e-0066-004800b30043.png",
        "timestamp": 1588428478265,
        "duration": 955
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4020,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e5009c-00d7-0092-0013-002a00a00094.png",
        "timestamp": 1588428480074,
        "duration": 5571
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5720,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": [
            "ReferenceError: ScriptName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:77:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bf0096-00b9-00cb-0053-00f500de00ca.png",
        "timestamp": 1588431952964,
        "duration": 3224
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5720,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: stepnumber is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:77:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: stepnumber is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:108:9)\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:50:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "000800b6-0089-0002-00b1-00b50017009b.png",
        "timestamp": 1588431956798,
        "duration": 1047
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 3208,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "009d0067-00b2-0072-000f-00d300110030.png",
        "timestamp": 1588432122466,
        "duration": 4
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3208,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: stepnumber is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:77:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: stepnumber is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:108:9)\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:53:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00970005-007a-004d-00c9-0040000e0009.png",
        "timestamp": 1588432122956,
        "duration": 3117
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 12252,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b300a8-007f-00b8-0036-003300940002.png",
        "timestamp": 1588432316654,
        "duration": 9
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12252,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: scriptName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:77:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: scriptName is not defined\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:45:39)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007a00d3-00b0-0075-00a8-00c700c7002b.png",
        "timestamp": 1588432317231,
        "duration": 2319
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 3556,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008500a2-005f-0064-0026-00330070002a.png",
        "timestamp": 1588432374777,
        "duration": 3
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3556,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: stepnumber is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:77:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: stepnumber is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:108:9)\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:53:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e30079-00a9-0017-00e4-001c00aa007d.png",
        "timestamp": 1588432375255,
        "duration": 3133
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 2800,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005f008c-0067-00be-0011-00c8007200ec.png",
        "timestamp": 1588432817250,
        "duration": 4
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 2800,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.129"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:138:131)\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:53:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "001600f1-00d3-0031-00d6-001000d500f7.png",
        "timestamp": 1588432817632,
        "duration": 4366
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 6240,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008700fa-009f-00c8-003f-000e0017003d.png",
        "timestamp": 1588441788108,
        "duration": 2
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6240,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:138:131)\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:53:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00770068-0023-006b-00ac-007600b4005f.png",
        "timestamp": 1588441789806,
        "duration": 3989
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 10408,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003c00a5-004c-00bf-0072-00cf00250050.png",
        "timestamp": 1588441869121,
        "duration": 2
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10408,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:138:131)\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:53:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007b0019-0003-00e8-00f8-001e007c000d.png",
        "timestamp": 1588441869327,
        "duration": 3913
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9300,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ce0002-0078-0085-00ed-007800ce00a7.png",
        "timestamp": 1588447574837,
        "duration": 4
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9300,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:141:131)\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:53:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00190093-00a2-00d7-004b-005a001300ae.png",
        "timestamp": 1588447575045,
        "duration": 3610
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11252,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00bb00e7-00d5-00d1-0025-006800ef0058.png",
        "timestamp": 1588447715949,
        "duration": 10
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11252,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00910012-00de-00cd-004a-00b4003f00b4.png",
        "timestamp": 1588447716295,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11252,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00510090-00fe-00f1-00e6-005c001e00e7.png",
        "timestamp": 1588447716326,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11252,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b5009f-0059-00db-00a0-00db0013002b.png",
        "timestamp": 1588447716364,
        "duration": 0
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11252,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:141:131)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_JasmineAssertion.js:48:28)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Checking other() method\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at handleError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4244:11)\n    at process.onerror (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:2371:17)\n    at process.emit (events.js:198:13)\n    at process.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\source-map-support\\source-map-support.js:439:21)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_JasmineAssertion.js:42:13)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_JasmineAssertion.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ab00ac-00a8-006d-008e-00dc00510021.png",
        "timestamp": 1588447716406,
        "duration": 5
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7236,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000700dd-009f-00d7-007e-0037002800d5.png",
        "timestamp": 1588447822319,
        "duration": 10
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7236,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00bc004f-00ba-0008-0043-00e700c50082.png",
        "timestamp": 1588447822637,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7236,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004800ed-0024-004b-007a-005300130051.png",
        "timestamp": 1588447822669,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7236,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00340009-0008-0007-00f2-0035006700d1.png",
        "timestamp": 1588447822696,
        "duration": 0
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7236,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006c0016-0071-00f2-00f9-00ec00f7008a.png",
        "timestamp": 1588447822727,
        "duration": 41
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 3028,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00680095-00a1-0066-0083-00cb004a0020.png",
        "timestamp": 1588449661321,
        "duration": 4
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3028,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:141:131)\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:49:20)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:43:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:27:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007c00e8-007d-0073-0012-002600fd000f.png",
        "timestamp": 1588449661554,
        "duration": 3364
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 5260,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004c0013-009e-0061-002d-0061008300aa.png",
        "timestamp": 1588450409965,
        "duration": 3
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5260,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: Report is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: Report is not defined\n    at C:\\ProtractorAutomation\\Pages\\Login.js:15:13\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:44:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:28:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "000a008a-00c2-0046-0084-006800f700a1.png",
        "timestamp": 1588450410171,
        "duration": 3207
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 4304,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005000e3-0070-007d-00dd-0059007d00cd.png",
        "timestamp": 1588450463134,
        "duration": 4
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4304,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:141:131)\n    at C:\\ProtractorAutomation\\Pages\\Login.js:16:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:44:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:28:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bb0048-001f-00bc-009d-008000db006d.png",
        "timestamp": 1588450463349,
        "duration": 2698
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11200,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008600c4-0087-003e-0073-00e7008b004c.png",
        "timestamp": 1588451449637,
        "duration": 6
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11200,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: ScriptName is not defined",
            "Failed: testCaseName is not defined"
        ],
        "trace": [
            "ReferenceError: ScriptName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:78:52\n    at FSReqWrap.readFileAfterClose [as oncomplete] (internal/fs/read_file_context.js:53:3)",
            "ReferenceError: testCaseName is not defined\n    at C:\\ProtractorAutomation\\Report\\GenerateReport.js:113:45\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:44:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:28:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00270016-0028-0000-0088-00a600dd00b2.png",
        "timestamp": 1588451449899,
        "duration": 5792
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3292,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: functio is not defined"
        ],
        "trace": [
            "ReferenceError: functio is not defined\n    at new base (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:20:5)\n    at new HomePage (C:\\ProtractorAutomation\\Pages\\HomePage.js:12:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:32:24)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006700b5-00e0-0002-0092-008500f500d4.png",
        "timestamp": 1589731226517,
        "duration": 1402
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4112,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: The value \"<td class='pass'><a style='color:#000000;'>Done</a></td>\" is invalid for option \"encoding\""
        ],
        "trace": [
            "TypeError [ERR_INVALID_OPT_VALUE_ENCODING]: The value \"<td class='pass'><a style='color:#000000;'>Done</a></td>\" is invalid for option \"encoding\"\n    at assertEncoding (internal/fs/utils.js:60:11)\n    at getOptions (internal/fs/utils.js:182:5)\n    at Object.appendFileSync (fs.js:1231:13)\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:148:16)\n    at C:\\ProtractorAutomation\\Pages\\HomePage.js:37:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fb00d9-003b-0015-007a-00a2001900d7.png",
        "timestamp": 1589731265679,
        "duration": 4220
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 664,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c900cc-0094-003d-0074-00fa006600cf.png",
        "timestamp": 1589731439526,
        "duration": 12412
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13960,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0005005a-005b-0085-003d-0030004100cb.png",
        "timestamp": 1589731786404,
        "duration": 12292
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15304,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: javascript error: argument is not defined\n  (Session info: chrome=80.0.3987.87)\n  (Driver info: chromedriver=80.0.3987.16 (320f6526c1632ad4f205ebce69b99a062ed78647-refs/branch-heads/3987@{#185}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: argument is not defined\n  (Session info: chrome=80.0.3987.87)\n  (Driver info: chromedriver=80.0.3987.16 (320f6526c1632ad4f205ebce69b99a062ed78647-refs/branch-heads/3987@{#185}),platform=Windows NT 10.0.14393 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as executeScript] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at HomePage.navigateToSetUp (C:\\ProtractorAutomation\\Pages\\HomePage.js:50:17)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:36:22)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "003200cd-009b-0034-008b-005b0039006d.png",
        "timestamp": 1589731858303,
        "duration": 13150
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8336,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: javascript error: argument is not defined\n  (Session info: chrome=80.0.3987.87)\n  (Driver info: chromedriver=80.0.3987.16 (320f6526c1632ad4f205ebce69b99a062ed78647-refs/branch-heads/3987@{#185}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: argument is not defined\n  (Session info: chrome=80.0.3987.87)\n  (Driver info: chromedriver=80.0.3987.16 (320f6526c1632ad4f205ebce69b99a062ed78647-refs/branch-heads/3987@{#185}),platform=Windows NT 10.0.14393 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as executeScript] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at HomePage.navigateToSetUp (C:\\ProtractorAutomation\\Pages\\HomePage.js:50:17)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:36:22)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008b00cc-007a-0014-00bf-00e800de007c.png",
        "timestamp": 1589731931514,
        "duration": 4018
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7648,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: javascript error: argument is not defined\n  (Session info: chrome=80.0.3987.87)\n  (Driver info: chromedriver=80.0.3987.16 (320f6526c1632ad4f205ebce69b99a062ed78647-refs/branch-heads/3987@{#185}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: argument is not defined\n  (Session info: chrome=80.0.3987.87)\n  (Driver info: chromedriver=80.0.3987.16 (320f6526c1632ad4f205ebce69b99a062ed78647-refs/branch-heads/3987@{#185}),platform=Windows NT 10.0.14393 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as executeScript] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at HomePage.navigateToSetUp (C:\\ProtractorAutomation\\Pages\\HomePage.js:49:17)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:36:22)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a500a9-00e3-0058-00e2-00ca000400c1.png",
        "timestamp": 1589732105313,
        "duration": 3927
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5028,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007400b3-009a-0099-00fb-002100100028.png",
        "timestamp": 1589732440651,
        "duration": 5368
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6392,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d00007-0045-00e4-00c0-001d00c70043.png",
        "timestamp": 1589732523253,
        "duration": 11648
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11192,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00960039-008e-0061-00ff-00e0004f009f.png",
        "timestamp": 1589732607447,
        "duration": 13355
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14044,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: The value \"<td class='pass'><a style='color:#000000;'>Done</a></td>\" is invalid for option \"encoding\""
        ],
        "trace": [
            "TypeError [ERR_INVALID_OPT_VALUE_ENCODING]: The value \"<td class='pass'><a style='color:#000000;'>Done</a></td>\" is invalid for option \"encoding\"\n    at assertEncoding (internal/fs/utils.js:60:11)\n    at getOptions (internal/fs/utils.js:182:5)\n    at Object.appendFileSync (fs.js:1231:13)\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:148:16)\n    at C:\\ProtractorAutomation\\Pages\\HomePage.js:37:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e000d1-0066-009a-00f5-00ce00dd00bc.png",
        "timestamp": 1589732808716,
        "duration": 4230
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13144,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac0050-00a4-00f7-003a-004500950014.png",
        "timestamp": 1589732913099,
        "duration": 14481
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a5003b-0084-00ed-00e6-005f00b400c7.png",
        "timestamp": 1589733127761,
        "duration": 15001
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1400,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: navigator is not defined"
        ],
        "trace": [
            "ReferenceError: navigator is not defined\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:37:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b6005d-00cf-00a6-009c-006500fb004b.png",
        "timestamp": 1589733427369,
        "duration": 1285
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2020,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006300f8-00e6-00a3-0004-0057002e00d5.png",
        "timestamp": 1589733713613,
        "duration": 13082
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13916,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008a003a-0058-006d-007e-00f900d50008.png",
        "timestamp": 1589733776058,
        "duration": 1618
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6196,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004000a8-005e-007c-0072-003000f70043.png",
        "timestamp": 1589741906430,
        "duration": 1577
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3660,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00870080-0038-00d6-00e2-003400c0004f.png",
        "timestamp": 1589741967344,
        "duration": 15491
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14808,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c00a7-00ec-000d-0081-000a00720037.png",
        "timestamp": 1589824590273,
        "duration": 14197
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12028,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00db0002-005a-0094-006b-00fe00a50007.png",
        "timestamp": 1589825376064,
        "duration": 4789
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14776,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000b00d1-0023-0046-0017-00e0005c00b5.png",
        "timestamp": 1589825458405,
        "duration": 4894
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15944,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b500e3-00ca-0014-0099-0020001500eb.png",
        "timestamp": 1589825828866,
        "duration": 2563
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15508,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005100ae-0093-00fd-00c1-003e004600fd.png",
        "timestamp": 1589825989865,
        "duration": 1801
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4780,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000a009d-0031-00fb-004a-00ba00040079.png",
        "timestamp": 1589826146814,
        "duration": 1652
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13604,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0088004c-00b7-0082-00c4-0006002400ff.png",
        "timestamp": 1589826933138,
        "duration": 1719
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 832,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ce0078-00e0-0017-004b-00b2007a0000.png",
        "timestamp": 1589827030068,
        "duration": 1923
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13200,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: sos is not defined"
        ],
        "trace": [
            "ReferenceError: sos is not defined\n    at GenerateReport.updateTest (C:\\ProtractorAutomation\\Report\\GenerateReport.js:106:57)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:30:16)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d6008f-00be-00f3-0007-0091002c00c4.png",
        "timestamp": 1589827073255,
        "duration": 1453
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13352,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ff000e-00bd-005e-00fd-006400100039.png",
        "timestamp": 1589827097598,
        "duration": 1300
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 32,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009f0020-00f0-00f1-00eb-009700b80099.png",
        "timestamp": 1589827182676,
        "duration": 2246
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10852,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00dc00f5-00e9-00c9-00e2-0099003a0025.png",
        "timestamp": 1589827541945,
        "duration": 1926
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5904,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00da00c0-00ab-0080-007a-004100600026.png",
        "timestamp": 1589827596577,
        "duration": 2361
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2500,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005f00ec-005f-0058-00b2-004300040020.png",
        "timestamp": 1589827626945,
        "duration": 2110
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15824,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f30001-009a-00d5-0065-00ee00f40043.png",
        "timestamp": 1589827790341,
        "duration": 1710
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7068,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0086000d-0094-0011-0013-008700660045.png",
        "timestamp": 1589827832419,
        "duration": 2311
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15872,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00650070-00dd-00bb-0050-008200c80069.png",
        "timestamp": 1589827854501,
        "duration": 1882
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12460,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b8009f-00eb-0008-001d-00ce00200080.png",
        "timestamp": 1589828532790,
        "duration": 1220
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14784,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005100e2-0067-000d-0040-0048006e0021.png",
        "timestamp": 1589828710660,
        "duration": 2723
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7424,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008d0098-0022-0020-0069-000c007d00b4.png",
        "timestamp": 1589828833356,
        "duration": 2954
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4928,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: elements is not defined"
        ],
        "trace": [
            "ReferenceError: elements is not defined\n    at new HomePage (C:\\ProtractorAutomation\\Pages\\HomePage.js:21:23)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:32:24)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00090009-00fe-00bd-008a-0038000600b4.png",
        "timestamp": 1589829941606,
        "duration": 574
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13336,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: Index out of bound. Trying to access element at index: 3, but there are only 3 elements that match locator By(xpath, //a[contains(@href,'tutorial')])"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at ontimeout (timers.js:436:11)\n    at tryOnTimeout (timers.js:300:5)\n    at listOnTimeout (timers.js:263:5)\n    at Timer.processTimers (timers.js:223:10)",
            "NoSuchElementError: Index out of bound. Trying to access element at index: 3, but there are only 3 elements that match locator By(xpath, //a[contains(@href,'tutorial')])\n    at selenium_webdriver_1.promise.all.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as executeScript] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at HomePage.navigateToTutorial (C:\\ProtractorAutomation\\Pages\\HomePage.js:87:17)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:40:22)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "001000ff-00f1-00e3-00df-00ed007e00df.png",
        "timestamp": 1589830015184,
        "duration": 23302
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12348,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: Tutorial.isPresent.then is not a function"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at ontimeout (timers.js:436:11)\n    at tryOnTimeout (timers.js:300:5)\n    at listOnTimeout (timers.js:263:5)\n    at Timer.processTimers (timers.js:223:10)",
            "TypeError: Tutorial.isPresent.then is not a function\n    at C:\\ProtractorAutomation\\Pages\\HomePage.js:94:32\n    at elementArrayFinder_.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a3006b-00b1-0026-000a-007000c80015.png",
        "timestamp": 1589830060909,
        "duration": 22867
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9728,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: Tutorial.isPresent.then is not a function"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at ontimeout (timers.js:436:11)\n    at tryOnTimeout (timers.js:300:5)\n    at listOnTimeout (timers.js:263:5)\n    at Timer.processTimers (timers.js:223:10)",
            "TypeError: Tutorial.isPresent.then is not a function\n    at C:\\ProtractorAutomation\\Pages\\HomePage.js:94:32\n    at elementArrayFinder_.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0078003d-00b2-00ac-0044-00cd006800f9.png",
        "timestamp": 1589830161165,
        "duration": 23347
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1376,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at ontimeout (timers.js:436:11)\n    at tryOnTimeout (timers.js:300:5)\n    at listOnTimeout (timers.js:263:5)\n    at Timer.processTimers (timers.js:223:10)"
        ],
        "browserLogs": [],
        "screenShotFile": "00980097-0074-0050-004b-0041005500fe.png",
        "timestamp": 1589830214799,
        "duration": 27053
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10764,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000600ed-001e-00a8-0054-00c600c200a3.png",
        "timestamp": 1589830341675,
        "duration": 27928
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3112,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d00f7-004b-0022-0089-00b2002c00c4.png",
        "timestamp": 1590249544285,
        "duration": 33175
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10260,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 2, but there are only 0 elements that match locator By(xpath, //a[contains(@href,'XXutorial')])"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 2, but there are only 0 elements that match locator By(xpath, //a[contains(@href,'XXutorial')])\n    at selenium_webdriver_1.promise.all.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as executeScript] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at HomePage.navigateToTutorial (C:\\ProtractorAutomation\\Pages\\HomePage.js:88:21)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:40:22)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0064008e-000e-005b-00e5-00c3009200e2.png",
        "timestamp": 1590253083229,
        "duration": 24588
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9944,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 2, but there are only 0 elements that match locator By(xpath, //a[contains(@href,'XXutorial')])"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 2, but there are only 0 elements that match locator By(xpath, //a[contains(@href,'XXutorial')])\n    at selenium_webdriver_1.promise.all.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as executeScript] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at HomePage.navigateToTutorial (C:\\ProtractorAutomation\\Pages\\HomePage.js:87:17)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:40:22)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00580019-000c-00c0-0069-002900ed00c6.png",
        "timestamp": 1590253656493,
        "duration": 23365
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9448,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e50058-004a-004e-00c3-00400051004f.png",
        "timestamp": 1590253742407,
        "duration": 22580
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17068,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: console.err is not a function"
        ],
        "trace": [
            "TypeError: console.err is not a function\n    at C:\\ProtractorAutomation\\Pages\\HomePage.js:100:25\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fe0079-00e3-00a4-00cf-007800ad000b.png",
        "timestamp": 1590259689309,
        "duration": 25256
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11560,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e500b9-00f9-009c-00a6-005a00780071.png",
        "timestamp": 1590259789406,
        "duration": 28914
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14260,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00eb00e0-0027-00b6-0040-005b00a90099.png",
        "timestamp": 1590261259561,
        "duration": 22675
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6272,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0091003d-00a6-0091-00a2-000d00a900f9.png",
        "timestamp": 1590261700969,
        "duration": 102143
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13136,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //a[text()=\"HXome\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"HXome\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\HomePage.js:29:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "000b00a0-00bc-007c-00e6-00d700d80022.png",
        "timestamp": 1590261909951,
        "duration": 2372
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15900,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //a[text()=\"HXome\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"HXome\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\HomePage.js:29:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Validate Home Page Details\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_HomePage_Validation.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006d00b7-0053-0026-00ce-0028000400a6.png",
        "timestamp": 1590261971606,
        "duration": 2215
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17160,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bb00c8-0007-006f-005a-0038006d006a.png",
        "timestamp": 1590262056586,
        "duration": 26187
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18232,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f10061-002e-0075-007f-008f00350020.png",
        "timestamp": 1590262292565,
        "duration": 27282
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4204,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00140070-002a-007c-003f-00a800bb00b5.png",
        "timestamp": 1590262358878,
        "duration": 28360
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11072,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc00c6-00a1-0044-0092-00f6007400bd.png",
        "timestamp": 1590262451243,
        "duration": 27485
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17296,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000c00f9-006f-00e4-000b-00c70096009d.png",
        "timestamp": 1590262669815,
        "duration": 10171
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16148,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007b002b-0060-0011-005b-009000160044.png",
        "timestamp": 1590262706528,
        "duration": 27445
    },
    {
        "description": "Validate Home Page Details|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16280,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e60038-000c-0076-006a-00af0080009b.png",
        "timestamp": 1590266009201,
        "duration": 29420
    },
    {
        "description": "To validate Home Page Details|Validation of www.protractortest.org HomePage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15612,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b00a1-0053-0058-00e4-00e6003a00b3.png",
        "timestamp": 1590327712280,
        "duration": 29760
    },
    {
        "description": "To validate Home Page Details|Validation of www.protractortest.org HomePage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4888,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00830093-00d7-0037-0092-006200b40062.png",
        "timestamp": 1590330753521,
        "duration": 46805
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11848,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Expected 'Protractor - end-to-end testing for AngularJS' to be 'http://www.newtours.demoaut.com/mercurywelcome.php'.",
            "Failed: ENOENT: no such file or directory, open 'undefined/ScriptResult.html'"
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "Error: ENOENT: no such file or directory, open 'undefined/ScriptResult.html'\n    at Object.openSync (fs.js:443:3)\n    at Object.writeFileSync (fs.js:1194:35)\n    at Object.appendFileSync (fs.js:1240:6)\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:129:12)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:24:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c500e1-004d-0056-0090-00410073008a.png",
        "timestamp": 1590344549603,
        "duration": 856
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17832,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'URL' of undefined",
            "Expected '' to be 'http://www.newtours.demoaut.com/mercurywelcome.php'.",
            "Failed: ENOENT: no such file or directory, open 'undefined/ScriptResult.html'"
        ],
        "trace": [
            "TypeError: Cannot read property 'URL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:31:55)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "Error: ENOENT: no such file or directory, open 'undefined/ScriptResult.html'\n    at Object.openSync (fs.js:443:3)\n    at Object.writeFileSync (fs.js:1194:35)\n    at Object.appendFileSync (fs.js:1240:6)\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:129:12)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:24:20\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "005b0033-0077-0041-0038-00ef00930098.png",
        "timestamp": 1590344586624,
        "duration": 213
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16224,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'URL' of undefined",
            "Expected '' to be 'http://www.newtours.demoaut.com/mercurywelcome.php'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'URL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:32:71)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "003800c4-006f-0040-0078-00ae0010005a.png",
        "timestamp": 1590344767803,
        "duration": 2286
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 920,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'URL' of undefined",
            "Expected '' to be 'http://www.newtours.demoaut.com/mercurywelcome.php'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'URL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:31:71)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0041006d-0000-002a-0035-00d3003200b3.png",
        "timestamp": 1590345486483,
        "duration": 2330
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17424,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'URL' of undefined",
            "Expected '' to be 'http://www.newtours.demoaut.com/mercurywelcome.php'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'URL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:31:100)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cb0098-00f4-0061-004d-00f4003d0032.png",
        "timestamp": 1590345543873,
        "duration": 2364
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18188,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'URL' of undefined",
            "Expected '' to be 'http://www.newtours.demoaut.com/mercurywelcome.php'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'URL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:32:100)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00360065-00ac-0036-0013-00f20096002c.png",
        "timestamp": 1590345598035,
        "duration": 2385
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14644,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'URL' of undefined",
            "Expected '' to be 'Welcome: Mercury Tours'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'URL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:31:71)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008e004e-0060-00d3-0043-006d00570003.png",
        "timestamp": 1590345738593,
        "duration": 2318
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15428,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'AppURL' of undefined",
            "Expected '' to be 'Welcome: Mercury Tours'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'AppURL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:31:71)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00920036-0049-004a-0007-00af00520015.png",
        "timestamp": 1590345949345,
        "duration": 2323
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5940,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'AppURL' of undefined",
            "Expected '' to be 'Welcome: Mercury Tours'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'AppURL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:31:71)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006b0023-006e-00cd-0021-00df008100d6.png",
        "timestamp": 1590346000798,
        "duration": 2335
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11036,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'AppURL' of undefined",
            "Expected '' to be 'Welcome: Mercury Tours'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'AppURL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:31:71)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ad006c-007f-00bd-00b4-0070007f0056.png",
        "timestamp": 1590346047736,
        "duration": 2208
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17396,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346073477,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346073848,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346074554,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346074982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346075015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346077588,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346077607,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346081512,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346081528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346087532,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346087553,
                "type": ""
            }
        ],
        "screenShotFile": "00720056-00f3-0062-004e-00bf00570051.png",
        "timestamp": 1590346074306,
        "duration": 13396
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17476,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: Cannot read property 'AppURL' of undefined",
            "Expected '' to be 'Welcome: Mercury Tours'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "TypeError: Cannot read property 'AppURL' of undefined\n    at UserContext.EnvironmentSetUp.beforeAll (C:\\ProtractorAutomation\\Test Environment\\Environment.js:32:71)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at new EnvironmentSetUp (C:\\ProtractorAutomation\\Test Environment\\Environment.js:18:13)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:27:23)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)",
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00aa00d9-0044-007f-009e-004d0091004a.png",
        "timestamp": 1590346248262,
        "duration": 2296
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17204,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Expected 'Protractor - end-to-end testing for AngularJS' to be 'Welcome: Mercury Tours'.",
            "Failed: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])"
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:22:35\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
            "NoSuchElementError: No element found using locator: By(xpath, //a[text()=\"REGISTER\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at base.click (C:\\ProtractorAutomation\\BaseClass\\BaseClass.js:17:17)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:46:18\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:28:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:25:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0047009f-00d8-00a9-00d2-0044009100ce.png",
        "timestamp": 1590346285270,
        "duration": 5356
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7936,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346401221,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346401603,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346402304,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346402692,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346402715,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346405252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346405262,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346408477,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346408491,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346414147,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346414171,
                "type": ""
            }
        ],
        "screenShotFile": "009f0003-0073-004b-00a0-003400b60072.png",
        "timestamp": 1590346402045,
        "duration": 12270
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11404,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346472487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346472869,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346473509,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346473917,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346473951,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346476489,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346476516,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346479666,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590346480730,
                "type": ""
            }
        ],
        "screenShotFile": "000700a5-0084-0086-0072-00af00980036.png",
        "timestamp": 1590346473259,
        "duration": 12591
    },
    {
        "description": "encountered a declaration exception|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13072,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "ReferenceError: using is not defined"
        ],
        "trace": [
            "ReferenceError: using is not defined\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:29:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:26:1)\n    at Module._compile (internal/modules/cjs/loader.js:776:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:787:10)\n    at Module.load (internal/modules/cjs/loader.js:653:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)\n    at Function.Module._load (internal/modules/cjs/loader.js:585:3)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590348738694,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590348738960,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590348739604,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590348740043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590348740093,
                "type": ""
            }
        ],
        "screenShotFile": "004e007c-0032-00a8-0044-006800fa0061.png",
        "timestamp": 1590348739315,
        "duration": 803
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16444,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": [
            "Failed: ENOENT: no such file or directory, open 'undefined/ScriptResult.html'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'undefined/ScriptResult.html'\n    at Object.openSync (fs.js:443:3)\n    at Object.writeFileSync (fs.js:1194:35)\n    at Object.appendFileSync (fs.js:1240:6)\n    at GenerateReport.udpateResult (C:\\ProtractorAutomation\\Report\\GenerateReport.js:129:12)\n    at C:\\ProtractorAutomation\\Pages\\MercuryHome.js:75:20\n    at elementArrayFinder_.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\nFrom: Task: Run it(\"To validate and check registration flow of user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:30:9\n    at C:\\ProtractorAutomation\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at C:\\ProtractorAutomation\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:29:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC03_MerucryFlight_Registration.js:26:1)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349122044,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349122468,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349123103,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349123563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349123699,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349126351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349126356,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349129570,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349129656,
                "type": ""
            }
        ],
        "screenShotFile": "00830061-0042-003b-00b7-00d000b10003.png",
        "timestamp": 1590349122862,
        "duration": 12209
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17744,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349305673,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349306023,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349306702,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349307136,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349307177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349309745,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349309796,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349313076,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349313104,
                "type": ""
            }
        ],
        "screenShotFile": "00a00079-00bb-0005-005c-001d00590096.png",
        "timestamp": 1590349306452,
        "duration": 25948
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6840,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349444936,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349445330,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349446016,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349446469,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349446503,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349449043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349449053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349452236,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349452339,
                "type": ""
            }
        ],
        "screenShotFile": "00e500c1-002d-0014-00d9-006400160050.png",
        "timestamp": 1590349445760,
        "duration": 25827
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17784,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349677614,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349677615,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349679288,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349679701,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349679794,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349682525,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349682536,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349685865,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590349685902,
                "type": ""
            }
        ],
        "screenShotFile": "00c60053-00a5-00d0-005d-00b7000d0066.png",
        "timestamp": 1590349678928,
        "duration": 28937
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9404,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350507295,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350507317,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350508566,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350509016,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350509051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350511929,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350511989,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350515382,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350515382,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350540623,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350540664,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350541696,
                "type": ""
            }
        ],
        "screenShotFile": "001f00ce-0069-0072-0079-008a009a006f.png",
        "timestamp": 1590350508289,
        "duration": 35152
    },
    {
        "description": "To validate and check registration flow of user|Registration flow E2E",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14428,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.87"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350669693,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350669956,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350671678,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350672206,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350672208,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350675021,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350675021,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350678322,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350678371,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://newtours.demoaut.com/black - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350703549,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://newtours.demoaut.com/images/spacer.gif - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350703607,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://newtours.demoaut.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1590350704643,
                "type": ""
            }
        ],
        "screenShotFile": "008300b3-004e-00db-0058-00dd00c1001b.png",
        "timestamp": 1590350671116,
        "duration": 35197
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
