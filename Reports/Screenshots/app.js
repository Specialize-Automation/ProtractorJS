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
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9248,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": [
            "Expected 'https://www.protractortest.org/#/' to be 'https://www.protractortest.org/'."
        ],
        "trace": [
            "Error: Failed expectation\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:21:29)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00560065-00c0-00ff-002a-00dc00d00062.png",
        "timestamp": 1574609273582,
        "duration": 2310
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9248,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002500aa-00ec-0028-002f-00c5003b007a.png",
        "timestamp": 1574609276881,
        "duration": 1255
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11404,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": [
            "Expected 'https://www.protractortest.org/#/' to be 'https://www.protractortest.org/'."
        ],
        "trace": [
            "Error: Failed expectation\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:21:29)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "002d0034-00e4-00ea-0064-0057002d0011.png",
        "timestamp": 1574609454006,
        "duration": 1836
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11404,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00180068-0039-007b-0057-00d3007900ea.png",
        "timestamp": 1574609456592,
        "duration": 1416
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 80,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": [
            "Expected 'https://www.protractortest.org/#/' to be 'https://www.protractortest.org/'."
        ],
        "trace": [
            "Error: Failed expectation\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:21:29)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f30095-008a-0000-00ea-004b00f900f2.png",
        "timestamp": 1574609526538,
        "duration": 2485
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 80,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee006f-00b6-007f-0005-00cf00c40094.png",
        "timestamp": 1574609530211,
        "duration": 1200
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11456,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00280022-0082-00c3-00eb-00cd00610057.png",
        "timestamp": 1574609654554,
        "duration": 2457
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11456,
        "browser": {
            "name": "chrome",
            "version": "78.0.3904.108"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a20092-005b-0087-0088-00d700e20086.png",
        "timestamp": 1574609657667,
        "duration": 1264
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3488,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0079004c-001b-007a-00c9-00bd007b007a.png",
        "timestamp": 1576414291744,
        "duration": 5064
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3488,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576414297307,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576414299682,
                "type": ""
            }
        ],
        "screenShotFile": "00b00019-0019-00e6-007e-008f006c0015.png",
        "timestamp": 1576414299357,
        "duration": 1641
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 16108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:32:29)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:7:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bf003f-00a5-00ae-00da-006800d700ab.png",
        "timestamp": 1576441350351,
        "duration": 2609
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 16108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:32:29)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:7:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576441353456,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576441355372,
                "type": ""
            }
        ],
        "screenShotFile": "000200f9-0090-0018-00ad-0031006c0011.png",
        "timestamp": 1576441355000,
        "duration": 1595
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:17)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:7:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "000d00c9-005b-00c3-00b8-00c6002f00a5.png",
        "timestamp": 1576441660828,
        "duration": 3047
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:17)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:7:1)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576441664754,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576441665040,
                "type": ""
            }
        ],
        "screenShotFile": "008000c9-00e5-009c-00a3-00b4005a0030.png",
        "timestamp": 1576441664736,
        "duration": 1045
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:17)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:7:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "00da00a3-008a-0026-00e4-00e500c90015.png",
        "timestamp": 1576441675587,
        "duration": 2543
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:17)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:7:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "00910064-00e4-0086-0080-00d1005400c1.png",
        "timestamp": 1576441679503,
        "duration": 1531
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fd005f-00cc-001a-0059-00ec00540057.png",
        "timestamp": 1576441859696,
        "duration": 2682
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576441863033,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576441863574,
                "type": ""
            }
        ],
        "screenShotFile": "006b007b-0024-00c1-0048-00f0005c00d2.png",
        "timestamp": 1576441863255,
        "duration": 1130
    },
    {
        "description": "Click on Protractor Setup|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576441865284,
                "type": ""
            }
        ],
        "screenShotFile": "007900d6-00cc-004a-0047-0006001400f4.png",
        "timestamp": 1576441865017,
        "duration": 1844
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2800,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005300f0-0087-0089-0008-00b500ed0013.png",
        "timestamp": 1576442167620,
        "duration": 2294
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2800,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442170786,
                "type": ""
            }
        ],
        "screenShotFile": "00570052-00c9-0030-00d8-009e00960076.png",
        "timestamp": 1576442170775,
        "duration": 1483
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2800,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442172447,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442172925,
                "type": ""
            }
        ],
        "screenShotFile": "00f70088-0058-0061-00ca-00ef00d100d8.png",
        "timestamp": 1576442172711,
        "duration": 1361
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 892,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dc0080-00cb-00ff-00c9-00ff00e70009.png",
        "timestamp": 1576442508434,
        "duration": 3107
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 892,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442512528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442513105,
                "type": ""
            }
        ],
        "screenShotFile": "001e0040-004a-0046-005a-00a000ad0068.png",
        "timestamp": 1576442512509,
        "duration": 1681
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 892,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442515248,
                "type": ""
            }
        ],
        "screenShotFile": "00420063-0011-007b-00ef-006d007d0074.png",
        "timestamp": 1576442514951,
        "duration": 8401
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 172,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a30060-007a-0055-0003-003d0012005b.png",
        "timestamp": 1576442546560,
        "duration": 3172
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 172,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442550766,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442551443,
                "type": ""
            }
        ],
        "screenShotFile": "003d0076-00cc-00af-00eb-009000db0055.png",
        "timestamp": 1576442550729,
        "duration": 1643
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 172,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576442553385,
                "type": ""
            }
        ],
        "screenShotFile": "00280030-00ea-0097-002d-006c00c800bc.png",
        "timestamp": 1576442553102,
        "duration": 11815
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5088,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004800f5-0001-0095-0028-00ec0086001a.png",
        "timestamp": 1576444614695,
        "duration": 2349
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5088,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576444617918,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576444618149,
                "type": ""
            }
        ],
        "screenShotFile": "001a0087-0026-0060-0096-0038001f0026.png",
        "timestamp": 1576444617900,
        "duration": 912
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5088,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: javascript error: Cannot read property 'indexOf' of null\n  (Session info: chrome=79.0.3945.79)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: Cannot read property 'indexOf' of null\n  (Session info: chrome=79.0.3945.79)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at JavascriptError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:157:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\by.js:191:35\n    at call (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1068:28)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:907:19\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: WebDriver.call(function)\n    at Driver.call (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:901:23)\n    at Driver.findElementsInternal_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1068:17)\n    at Driver.findElements (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1043:19)\n    at Object.findElementsOverride (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\locators.js:384:31)\n    at ptor.waitForAngular.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:156:40)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:38:69\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576444619549,
                "type": ""
            }
        ],
        "screenShotFile": "00b700e1-0070-00e3-00b8-0057006000b4.png",
        "timestamp": 1576444619337,
        "duration": 3675
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15904,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a0055-00de-0097-0064-003d00530039.png",
        "timestamp": 1576444653971,
        "duration": 3740
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15904,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576444658186,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576444658647,
                "type": ""
            }
        ],
        "screenShotFile": "00e40091-0038-0025-00f1-000300b70092.png",
        "timestamp": 1576444658401,
        "duration": 881
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15904,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: javascript error: Cannot read property 'indexOf' of null\n  (Session info: chrome=79.0.3945.79)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: Cannot read property 'indexOf' of null\n  (Session info: chrome=79.0.3945.79)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at JavascriptError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:157:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\by.js:191:35\n    at call (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1068:28)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:907:19\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: WebDriver.call(function)\n    at Driver.call (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:901:23)\n    at Driver.findElementsInternal_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1068:17)\n    at Driver.findElements (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1043:19)\n    at Object.findElementsOverride (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\locators.js:384:31)\n    at ptor.waitForAngular.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:156:40)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:38:69\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576444659899,
                "type": ""
            }
        ],
        "screenShotFile": "00d800e4-00c5-00f9-00e6-000d00f10044.png",
        "timestamp": 1576444659742,
        "duration": 1091
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3376,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0080001e-00d6-0097-0005-004c00150097.png",
        "timestamp": 1576445125809,
        "duration": 2329
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3376,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445128555,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445129217,
                "type": ""
            }
        ],
        "screenShotFile": "004d00ef-00d9-0079-00df-007d005100ad.png",
        "timestamp": 1576445128962,
        "duration": 1123
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3376,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445131040,
                "type": ""
            }
        ],
        "screenShotFile": "009700d8-0007-00ad-0047-00ea00900013.png",
        "timestamp": 1576445130722,
        "duration": 4045
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13124,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ce0024-0032-00ae-00ee-000b0027007a.png",
        "timestamp": 1576445490305,
        "duration": 2569
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13124,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445493964,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445494528,
                "type": ""
            }
        ],
        "screenShotFile": "005f00f1-00b8-007f-0051-00c6004b0048.png",
        "timestamp": 1576445493947,
        "duration": 1901
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13124,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445496823,
                "type": ""
            }
        ],
        "screenShotFile": "0076005c-0040-00e2-0093-00eb000d0047.png",
        "timestamp": 1576445496518,
        "duration": 4417
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0015005d-00d9-0015-00d9-005d00e5001f.png",
        "timestamp": 1576445520092,
        "duration": 2171
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445523295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445523603,
                "type": ""
            }
        ],
        "screenShotFile": "00770073-00a5-00a7-0042-00df005c00dc.png",
        "timestamp": 1576445523279,
        "duration": 1105
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445525669,
                "type": ""
            }
        ],
        "screenShotFile": "00f4004e-00b7-00c0-00aa-009600c3001d.png",
        "timestamp": 1576445525261,
        "duration": 4563
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00af0022-00bf-004f-00fc-00db00b000e4.png",
        "timestamp": 1576445610095,
        "duration": 1998
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445612834,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445613301,
                "type": ""
            }
        ],
        "screenShotFile": "00d100cb-0036-000e-0003-0013006200a5.png",
        "timestamp": 1576445613058,
        "duration": 997
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: element.all(...).get(...).element.all is not a function"
        ],
        "trace": [
            "TypeError: element.all(...).get(...).element.all is not a function\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:68\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576445614979,
                "type": ""
            }
        ],
        "screenShotFile": "00e00071-003b-0006-00a6-002400fb0062.png",
        "timestamp": 1576445614789,
        "duration": 1130
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12472,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc008c-0087-00e8-0048-00a700a5008a.png",
        "timestamp": 1576446010448,
        "duration": 2784
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12472,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d4009d-004a-0023-0010-00d00062003b.png",
        "timestamp": 1576446013933,
        "duration": 1355
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12472,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: element(...).element.all is not a function"
        ],
        "trace": [
            "TypeError: element(...).element.all is not a function\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:69\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446015856,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446016254,
                "type": ""
            }
        ],
        "screenShotFile": "009900e8-0066-0032-00d7-000800a70026.png",
        "timestamp": 1576446015940,
        "duration": 1794
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10712,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ed006e-009a-0079-0097-007600f30021.png",
        "timestamp": 1576446161218,
        "duration": 2494
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10712,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446164200,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446165046,
                "type": ""
            }
        ],
        "screenShotFile": "008900d6-0048-003f-00ab-006500b900bb.png",
        "timestamp": 1576446164738,
        "duration": 973
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10712,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.79)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.79)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at ElementNotInteractableError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:63:5)\n    at ElementNotVisibleError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:77:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: WebElement.click()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (native)\n    at actionResults.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:121\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446166527,
                "type": ""
            }
        ],
        "screenShotFile": "005300d2-0061-0046-0074-009b009d00d7.png",
        "timestamp": 1576446166287,
        "duration": 1321
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9128,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c00ac-0067-0022-0048-002d000b002b.png",
        "timestamp": 1576446213281,
        "duration": 2251
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9128,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446216346,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446217013,
                "type": ""
            }
        ],
        "screenShotFile": "00b100b8-00c5-009f-0053-00130043000f.png",
        "timestamp": 1576446216694,
        "duration": 965
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9128,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:121\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446218439,
                "type": ""
            }
        ],
        "screenShotFile": "001a006f-00d6-009a-0067-006c00b200e3.png",
        "timestamp": 1576446218213,
        "duration": 1381
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d00fb-008b-0012-0029-003800c3000f.png",
        "timestamp": 1576446359303,
        "duration": 2576
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446362604,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446363142,
                "type": ""
            }
        ],
        "screenShotFile": "00ab0027-0032-00be-008f-004e00d100f4.png",
        "timestamp": 1576446362872,
        "duration": 970
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:99\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446364676,
                "type": ""
            }
        ],
        "screenShotFile": "0024002a-00d4-0047-009e-00b5005b0061.png",
        "timestamp": 1576446364492,
        "duration": 1593
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15220,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00730005-0058-00ef-0058-00b4005d000e.png",
        "timestamp": 1576446462191,
        "duration": 2050
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15220,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446465072,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446465287,
                "type": ""
            }
        ],
        "screenShotFile": "00e600da-00fa-0087-0039-0081008500f4.png",
        "timestamp": 1576446465063,
        "duration": 984
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15220,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:123\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446467029,
                "type": ""
            }
        ],
        "screenShotFile": "00ee009e-00c7-0075-00ef-00f2003f003a.png",
        "timestamp": 1576446466732,
        "duration": 2298
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15468,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00480071-002d-008f-0095-002500310060.png",
        "timestamp": 1576446763916,
        "duration": 2898
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15468,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446767294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446768281,
                "type": ""
            }
        ],
        "screenShotFile": "00f10080-0034-0075-00f0-0016001900eb.png",
        "timestamp": 1576446767968,
        "duration": 1231
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15468,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, .li)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, .li)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:132\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446770352,
                "type": ""
            }
        ],
        "screenShotFile": "002200ed-0069-0001-005c-008400bf00e5.png",
        "timestamp": 1576446770048,
        "duration": 2183
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4008,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00980070-0003-00cc-00a9-008100de002b.png",
        "timestamp": 1576446848697,
        "duration": 2286
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4008,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446851863,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446852097,
                "type": ""
            }
        ],
        "screenShotFile": "00eb0022-00f6-0028-0067-008000e50095.png",
        "timestamp": 1576446851856,
        "duration": 925
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4008,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.79"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:131\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1576446853489,
                "type": ""
            }
        ],
        "screenShotFile": "00a4003b-0006-0083-0093-00e6001c0000.png",
        "timestamp": 1576446853307,
        "duration": 1341
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8120,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001600a0-00f9-0055-0009-003e00440062.png",
        "timestamp": 1577448179211,
        "duration": 2126
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8120,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448182109,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448182939,
                "type": ""
            }
        ],
        "screenShotFile": "00a000f0-00dd-0039-00f8-007700a0001f.png",
        "timestamp": 1577448182708,
        "duration": 925
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8120,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:131\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448184547,
                "type": ""
            }
        ],
        "screenShotFile": "0054008e-007e-0045-0088-00af000800e0.png",
        "timestamp": 1577448184296,
        "duration": 2750
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00600091-00a5-0050-0022-00b900770016.png",
        "timestamp": 1577448322535,
        "duration": 2024
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448325143,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448325772,
                "type": ""
            }
        ],
        "screenShotFile": "006a0022-004e-00d2-0081-00a7002e0094.png",
        "timestamp": 1577448325478,
        "duration": 1039
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9388,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:131\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448327466,
                "type": ""
            }
        ],
        "screenShotFile": "00d3008f-000e-00e4-0051-006e00390020.png",
        "timestamp": 1577448327203,
        "duration": 1942
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6888,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00db00a0-0089-005a-005e-001c003b00d9.png",
        "timestamp": 1577448422519,
        "duration": 2356
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6888,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448425458,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448426190,
                "type": ""
            }
        ],
        "screenShotFile": "008d0086-00db-00ce-00e4-00f400b90001.png",
        "timestamp": 1577448425804,
        "duration": 1162
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6888,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at ElementNotInteractableError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:63:5)\n    at ElementNotVisibleError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:77:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: WebElement.click()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (native)\n    at actionResults.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:38:73\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448429593,
                "type": ""
            }
        ],
        "screenShotFile": "00260017-00ac-00ee-0091-00e200390040.png",
        "timestamp": 1577448427620,
        "duration": 4729
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004a0052-003a-0022-008a-006000a300d2.png",
        "timestamp": 1577448470450,
        "duration": 2252
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448473285,
                "type": ""
            }
        ],
        "screenShotFile": "004e0064-00d8-00f7-00dc-00f600ed004f.png",
        "timestamp": 1577448473517,
        "duration": 1734
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448475464,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448476166,
                "type": ""
            }
        ],
        "screenShotFile": "00000046-0037-007a-0020-00fc004000f1.png",
        "timestamp": 1577448475917,
        "duration": 9036
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10564,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c0084-00da-0042-0022-009700c300e8.png",
        "timestamp": 1577448890034,
        "duration": 2959
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10564,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448894214,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448894931,
                "type": ""
            }
        ],
        "screenShotFile": "003700b9-00c4-00fe-0062-006300e40021.png",
        "timestamp": 1577448894591,
        "duration": 1230
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10564,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:123\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448896988,
                "type": ""
            }
        ],
        "screenShotFile": "00a90092-0017-007a-00f9-001a00940097.png",
        "timestamp": 1577448896677,
        "duration": 4641
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004a00f5-0006-006b-0065-0043009a008d.png",
        "timestamp": 1577448932849,
        "duration": 2134
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448935256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448936046,
                "type": ""
            }
        ],
        "screenShotFile": "004f002c-002a-000f-00e9-00c100120089.png",
        "timestamp": 1577448935775,
        "duration": 970
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:123\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448937653,
                "type": ""
            }
        ],
        "screenShotFile": "000600f8-0007-00c4-0006-000c00060080.png",
        "timestamp": 1577448937398,
        "duration": 1872
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a500ba-0075-0015-005a-004b002600b5.png",
        "timestamp": 1577448987001,
        "duration": 2242
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448989756,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448990447,
                "type": ""
            }
        ],
        "screenShotFile": "000e00cb-0061-009c-00d9-000d00e300cb.png",
        "timestamp": 1577448990132,
        "duration": 1075
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"a\", \"Setting Up the Browser\")\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchElementError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:192:5)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:40:131\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577448992157,
                "type": ""
            }
        ],
        "screenShotFile": "0008003e-0069-00cd-004f-003c004a0022.png",
        "timestamp": 1577448991888,
        "duration": 1917
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3924,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00800096-00da-00cf-0064-00140071002f.png",
        "timestamp": 1577451276986,
        "duration": 2682
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3924,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at ElementNotInteractableError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:63:5)\n    at ElementNotVisibleError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:77:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: WebElement.click()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (native)\n    at actionResults.getWebElements.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function) [as click] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:38:73\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:33:10)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577451280418,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577451281994,
                "type": ""
            }
        ],
        "screenShotFile": "008f00a9-006d-0056-00d3-006b004600ab.png",
        "timestamp": 1577451281365,
        "duration": 5232
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fd0098-00a3-002c-00da-00f20030004d.png",
        "timestamp": 1577451320665,
        "duration": 7517
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 752,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577451328902,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577451330105,
                "type": ""
            }
        ],
        "screenShotFile": "00ec00ca-00b7-0054-00f5-00a700f2000c.png",
        "timestamp": 1577451329233,
        "duration": 9508
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3776,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00110063-0029-0062-00c3-005b00630010.png",
        "timestamp": 1577451975726,
        "duration": 2620
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3776,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577451979180,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1577451979814,
                "type": ""
            }
        ],
        "screenShotFile": "004e00ff-0001-00ca-00e7-00b3006200c9.png",
        "timestamp": 1577451979536,
        "duration": 8986
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12528,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ea00ff-00e3-008a-001b-003c009b002e.png",
        "timestamp": 1579146005352,
        "duration": 13
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12528,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00fe00f3-00e4-00fe-00d0-000400800091.png",
        "timestamp": 1579146005765,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4116,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: x is not defined"
        ],
        "trace": [
            "ReferenceError: x is not defined\n    at UserContext.beforeAll (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:12:57)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:10:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:8:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ba0016-00b7-006b-00c5-00be00f70075.png",
        "timestamp": 1579146064979,
        "duration": 2764
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 4116,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579146068732,
                "type": ""
            }
        ],
        "screenShotFile": "00b4004d-0071-0085-007c-00aa000700f5.png",
        "timestamp": 1579146069020,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f500b5-00c4-00e5-00b1-00790074000d.png",
        "timestamp": 1579146098028,
        "duration": 2285
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579146100610,
                "type": ""
            }
        ],
        "screenShotFile": "0017002d-00ed-0009-0095-006a0076000c.png",
        "timestamp": 1579146101171,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11996,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee00a8-0014-0071-0053-002900f60095.png",
        "timestamp": 1579146424917,
        "duration": 1703
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11996,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579146427600,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579146428049,
                "type": ""
            }
        ],
        "screenShotFile": "005f002e-0053-0079-00cf-008d00670023.png",
        "timestamp": 1579146427565,
        "duration": 1377
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 11996,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008900ec-00b6-00c5-009f-002500c9005f.png",
        "timestamp": 1579146429710,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 404,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e1003e-002b-006d-00ab-00cb0075003a.png",
        "timestamp": 1579147050854,
        "duration": 9
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 404,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00c60044-0044-00f9-009e-009000ec00ce.png",
        "timestamp": 1579147051213,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 404,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006c00b6-00cb-0056-001e-00a5003600c2.png",
        "timestamp": 1579147051465,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 404,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007500d6-008f-00fa-00e3-000b00f60063.png",
        "timestamp": 1579147051644,
        "duration": 1329
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 224,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007500f7-0002-00d2-00a9-000c00970011.png",
        "timestamp": 1579147314148,
        "duration": 2537
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 224,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579147317529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579147318242,
                "type": ""
            }
        ],
        "screenShotFile": "00d800da-0016-002e-00a4-00b900cd0014.png",
        "timestamp": 1579147317936,
        "duration": 949
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 224,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00cd0099-0051-00ce-006c-00b3001a000b.png",
        "timestamp": 1579147319454,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 224,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00210082-007d-009f-004d-00c300ed0016.png",
        "timestamp": 1579147319541,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003b006d-00ab-0002-00e3-00f3006000e5.png",
        "timestamp": 1579147424477,
        "duration": 7
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00aa003e-0025-008c-0019-00cf000f004e.png",
        "timestamp": 1579147424756,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003100d0-0017-0042-0067-0008003700bd.png",
        "timestamp": 1579147425088,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00eb006c-0004-009c-0020-00c9002c00dc.png",
        "timestamp": 1579147425320,
        "duration": 970
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b80047-00a2-0000-0078-003b001300f3.png",
        "timestamp": 1579147480748,
        "duration": 14
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008a009e-0006-0016-0020-00a900a100cc.png",
        "timestamp": 1579147481224,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a3009c-000c-002d-00ce-008b0030006a.png",
        "timestamp": 1579147481398,
        "duration": 1
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10448,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e0072-00e2-00fe-0072-002200be00c4.png",
        "timestamp": 1579147481673,
        "duration": 765
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 9284,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004000cc-00d3-004b-0084-00ba00bb0068.png",
        "timestamp": 1579147679450,
        "duration": 9
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 9284,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b800b3-00dd-0094-009e-00cc005a0028.png",
        "timestamp": 1579147679796,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 9284,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00fd0083-00db-0017-003b-00e6006200b1.png",
        "timestamp": 1579147680036,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9284,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009b0079-003a-0025-00f4-006c0041006b.png",
        "timestamp": 1579147680290,
        "duration": 1329
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 2884,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e8008f-00a2-0062-0030-0069006b00a5.png",
        "timestamp": 1579147840994,
        "duration": 6
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 2884,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005800d0-00f5-0063-00de-0044007b002b.png",
        "timestamp": 1579147841315,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 2884,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a40024-00fc-00c5-00a1-005900ec0031.png",
        "timestamp": 1579147841516,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2884,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: checkValue.toEqual is not a function"
        ],
        "trace": [
            "TypeError: checkValue.toEqual is not a function\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:50:32)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Checking toEqual() method\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:49:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007a0091-00cb-000a-0002-001400a60016.png",
        "timestamp": 1579147841680,
        "duration": 872
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00710041-00ed-00fb-004f-0061009700d6.png",
        "timestamp": 1579147887791,
        "duration": 14
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d200a9-008a-00bd-00ce-004d00a7002f.png",
        "timestamp": 1579147888327,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00bb0063-00b8-00ce-00e2-0023000d00c0.png",
        "timestamp": 1579147888511,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: checkValue.toEqual is not a function"
        ],
        "trace": [
            "TypeError: checkValue.toEqual is not a function\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:50:30)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Checking toEqual() method\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:49:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579147889049,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579147889291,
                "type": ""
            }
        ],
        "screenShotFile": "00e60033-0019-00b1-0096-008e00b500be.png",
        "timestamp": 1579147888739,
        "duration": 1077
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13568,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00f30039-00d2-00f2-00da-00a000710076.png",
        "timestamp": 1579148189596,
        "duration": 7
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13568,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0005000d-0040-005a-005b-004100960055.png",
        "timestamp": 1579148189932,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13568,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d20025-000f-001d-00f3-000900430051.png",
        "timestamp": 1579148190340,
        "duration": 1
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13568,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: Cannot read property 'then' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'then' of undefined\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:50:44)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Checking toEqual() method\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:49:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00910069-0001-00b4-00fe-00d3004700cc.png",
        "timestamp": 1579148190522,
        "duration": 1294
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13780,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d50024-005a-0010-006d-005b000c002e.png",
        "timestamp": 1579148264161,
        "duration": 9
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13780,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008c0088-0036-0020-0058-005c00050023.png",
        "timestamp": 1579148264847,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13780,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e10008-00b5-0030-0000-009e00870042.png",
        "timestamp": 1579148265110,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13780,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: checkValue.toEqual is not a function"
        ],
        "trace": [
            "TypeError: checkValue.toEqual is not a function\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:50:35)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Checking toEqual() method\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:49:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579148265339,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579148265562,
                "type": ""
            }
        ],
        "screenShotFile": "009c00cc-003e-007d-0044-00a800a00038.png",
        "timestamp": 1579148265294,
        "duration": 627
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00290058-0023-00ff-0034-0067008a0077.png",
        "timestamp": 1579200028465,
        "duration": 4
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ff008a-000b-00db-00ea-0067003500d3.png",
        "timestamp": 1579200028888,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a10031-00d4-0045-000f-000900230032.png",
        "timestamp": 1579200029018,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: Cannot read property 'then' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'then' of undefined\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:50:44)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Checking toEqual() method\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:49:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "003300d9-00ce-00ec-0059-0061006a003e.png",
        "timestamp": 1579200029059,
        "duration": 448
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13776,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00cd00ff-003c-006c-0086-002e000700d9.png",
        "timestamp": 1579200089885,
        "duration": 7
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13776,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ba0026-00c2-004f-00cd-00c000ed00d7.png",
        "timestamp": 1579200090346,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 13776,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ca0050-007e-0078-00ac-007a00db0048.png",
        "timestamp": 1579200090548,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13776,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b003e-00ac-002d-00b7-00bf00e800c3.png",
        "timestamp": 1579200090986,
        "duration": 1213
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3292,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005700fd-00d3-0034-0020-00a400f4005c.png",
        "timestamp": 1579200115256,
        "duration": 4
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3292,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001000df-0067-0078-00ff-0022005500d6.png",
        "timestamp": 1579200115518,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3292,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ff00db-00b7-004d-005d-00c8009e0091.png",
        "timestamp": 1579200115734,
        "duration": 1
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3292,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 0 to equal 1."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:50:34)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00160014-00bf-0028-0011-00e200610047.png",
        "timestamp": 1579200115853,
        "duration": 627
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3800,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0099000c-0014-003b-0059-006e00d4001f.png",
        "timestamp": 1579200302350,
        "duration": 8
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3800,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0080008e-0067-0046-00ac-000b00a700e8.png",
        "timestamp": 1579200303141,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3800,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a00057-00e5-008f-008e-005a005d0012.png",
        "timestamp": 1579200303565,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3800,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579200303828,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579200304348,
                "type": ""
            }
        ],
        "screenShotFile": "00bd0002-00ce-0007-007c-003b0037007e.png",
        "timestamp": 1579200303794,
        "duration": 1049
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12728,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00bf00eb-00c2-006b-001f-00a600a10094.png",
        "timestamp": 1579200357772,
        "duration": 12
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12728,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00500074-0047-0009-00be-006a0005000d.png",
        "timestamp": 1579200358122,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12728,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e50083-0082-0033-002a-0009000100ff.png",
        "timestamp": 1579200358267,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12728,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00670026-00ed-00f1-00fd-000a00da00ea.png",
        "timestamp": 1579200358483,
        "duration": 1790
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5964,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005a000b-00b2-00cf-0051-00b400250018.png",
        "timestamp": 1579200717667,
        "duration": 12
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5964,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001500fe-001c-0036-0008-001b002b0004.png",
        "timestamp": 1579200717968,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5964,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e5004d-0008-00b9-008d-00cf0062007a.png",
        "timestamp": 1579200718293,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5964,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 0 to equal 1."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:51:38)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "001b00bd-002e-0038-005d-002f008e002d.png",
        "timestamp": 1579200718536,
        "duration": 997
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14676,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "009f006f-0078-0003-00f6-00aa00120045.png",
        "timestamp": 1579231414740,
        "duration": 19
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14676,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0007002d-0005-0096-004a-00af008c0085.png",
        "timestamp": 1579231415145,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14676,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00db00b7-00bd-00bb-0048-00aa00cb0064.png",
        "timestamp": 1579231415563,
        "duration": 5
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14676,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: checkValue.toEqual is not a function"
        ],
        "trace": [
            "TypeError: checkValue.toEqual is not a function\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:51:30)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Checking toEqual() method\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:49:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e6006e-003c-0050-00f4-001a000800b3.png",
        "timestamp": 1579231415772,
        "duration": 1363
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004000f2-0070-002c-007d-0022005c00c9.png",
        "timestamp": 1579232160008,
        "duration": 10
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001900a4-0034-008e-0041-006e0008006f.png",
        "timestamp": 1579232160294,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d4002c-003e-006f-0018-00f300ed002b.png",
        "timestamp": 1579232160717,
        "duration": 1
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000e0008-00c2-0005-0058-005d002b00d0.png",
        "timestamp": 1579232160936,
        "duration": 952
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14928,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000a0068-0064-006c-0077-001c005300fe.png",
        "timestamp": 1579232196497,
        "duration": 7
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14928,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00eb0076-00c5-009c-0043-005300150007.png",
        "timestamp": 1579232196823,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14928,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00000041-0071-00ba-00aa-00ea008b00e8.png",
        "timestamp": 1579232197166,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14928,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 0 to equal 1."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:50:38)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00f90088-00cb-0098-0059-003100cf00f5.png",
        "timestamp": 1579232197462,
        "duration": 1234
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14980,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00630090-0021-0085-0031-002300b900ee.png",
        "timestamp": 1579232279559,
        "duration": 16
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14980,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ec00eb-00a6-00b9-0056-00da00c60097.png",
        "timestamp": 1579232280360,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14980,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ed00a8-00c5-0098-00ea-00b200f70071.png",
        "timestamp": 1579232280736,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14980,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 0 to equal 1."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:52:36)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579232280955,
                "type": ""
            }
        ],
        "screenShotFile": "00790006-009f-0064-00e3-0080001300bb.png",
        "timestamp": 1579232280871,
        "duration": 1713
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001e00fe-0003-0025-00be-0004009600ef.png",
        "timestamp": 1579233697255,
        "duration": 10
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "009f00a6-0047-006e-00b8-00a0006200ae.png",
        "timestamp": 1579233697639,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b80061-0035-008b-004e-005a00460040.png",
        "timestamp": 1579233698005,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009f0072-00f2-00ee-00be-0070003000c1.png",
        "timestamp": 1579233698226,
        "duration": 928
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579233699898,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579233700333,
                "type": ""
            }
        ],
        "screenShotFile": "00eb00f1-00d7-005a-00c6-002200c500cc.png",
        "timestamp": 1579233699888,
        "duration": 730
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12068,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00670077-0092-00d4-0074-0022006c0025.png",
        "timestamp": 1579233734493,
        "duration": 8
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12068,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a1000a-0044-008a-0068-0006002e00a7.png",
        "timestamp": 1579233734817,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12068,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e200bd-0029-00b9-00e8-00660034001f.png",
        "timestamp": 1579233735021,
        "duration": 1
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12068,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ef005d-00e7-0078-0081-003e00f400a7.png",
        "timestamp": 1579233735209,
        "duration": 695
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12068,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected '0' to be 0."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:56:36)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579233736622,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579233737004,
                "type": ""
            }
        ],
        "screenShotFile": "00fe0020-002b-0052-0064-00f800d200b2.png",
        "timestamp": 1579233736615,
        "duration": 726
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15304,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a900b4-0008-0070-00e0-0008006a0023.png",
        "timestamp": 1579233764091,
        "duration": 13
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15304,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00870046-008b-0046-007c-008d00a1003d.png",
        "timestamp": 1579233764639,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15304,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0001004f-00dd-00aa-000f-00b1008b0029.png",
        "timestamp": 1579233764853,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15304,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b700ce-0014-00ac-00f6-008f001100d4.png",
        "timestamp": 1579233765200,
        "duration": 820
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15304,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579233766449,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579233767223,
                "type": ""
            }
        ],
        "screenShotFile": "00220025-00d1-0059-0021-00440094008d.png",
        "timestamp": 1579233766885,
        "duration": 795
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00cc005e-009a-009a-0046-00af00d30058.png",
        "timestamp": 1579234067755,
        "duration": 5
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003b00c5-006e-006a-00a0-0018008d00c5.png",
        "timestamp": 1579234068528,
        "duration": 3
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "009e00af-00ed-006f-0050-00d200910086.png",
        "timestamp": 1579234068835,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579234069157,
                "type": ""
            }
        ],
        "screenShotFile": "00aa00ef-002e-008e-0043-00e4002e000b.png",
        "timestamp": 1579234069112,
        "duration": 34
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008f00dd-00fe-005a-001c-004f006a007a.png",
        "timestamp": 1579234069718,
        "duration": 10
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00190028-00f4-0013-0079-0030007200a7.png",
        "timestamp": 1579234070422,
        "duration": 27
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0069003b-00c6-0096-0072-0079007700ad.png",
        "timestamp": 1579234071134,
        "duration": 16
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12704,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00df000f-00a9-00d2-00e2-00a400a20065.png",
        "timestamp": 1579234137265,
        "duration": 18
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12704,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00be00d2-0039-003a-00a2-009c00600094.png",
        "timestamp": 1579234137775,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12704,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00770059-0088-0046-007f-00f300fa0017.png",
        "timestamp": 1579234138153,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12704,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579234138419,
                "type": ""
            }
        ],
        "screenShotFile": "00390089-00d0-00ab-0054-00b200cf0047.png",
        "timestamp": 1579234138362,
        "duration": 44
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12704,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00830029-000f-003e-0025-007c00b7001f.png",
        "timestamp": 1579234138986,
        "duration": 8
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12704,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 0 not to equal 0."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:62:40)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "008900fd-0066-00a2-00c4-000c00070022.png",
        "timestamp": 1579234139645,
        "duration": 23
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12704,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f6003b-0046-0085-001f-001e00f400a1.png",
        "timestamp": 1579234140399,
        "duration": 27
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10744,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00270003-00f4-00f4-0020-00520032005a.png",
        "timestamp": 1579234190109,
        "duration": 17
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10744,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006e005f-00f0-0009-00ad-008b004000b0.png",
        "timestamp": 1579234190720,
        "duration": 16
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10744,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579234191551,
                "type": ""
            }
        ],
        "screenShotFile": "005500e3-00e7-00b9-0007-00470067006c.png",
        "timestamp": 1579234191449,
        "duration": 1
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10744,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007b00ab-000e-009a-003a-00c600ef00fe.png",
        "timestamp": 1579234191732,
        "duration": 56
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10744,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d10006-00ec-00fd-002b-00a600170007.png",
        "timestamp": 1579234192444,
        "duration": 40
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10744,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e0090-00d6-0092-00a1-00ec00bd00b6.png",
        "timestamp": 1579234193140,
        "duration": 18
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10744,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004c00bf-0002-00ee-0061-006c00580093.png",
        "timestamp": 1579234193883,
        "duration": 34
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00670002-0037-000f-0089-0060009d00ea.png",
        "timestamp": 1579236509175,
        "duration": 6
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001800a6-0039-00a4-0039-0026008900aa.png",
        "timestamp": 1579236509511,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00310003-0057-00f1-00a6-007f00f4002b.png",
        "timestamp": 1579236509703,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fa0096-00e5-002c-000f-00e9006400cb.png",
        "timestamp": 1579236509886,
        "duration": 51
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579236510471,
                "type": ""
            }
        ],
        "screenShotFile": "009c0025-00a4-0071-001d-00b2003e00ac.png",
        "timestamp": 1579236510580,
        "duration": 19
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009d00e9-0086-00c5-00c7-006300e00025.png",
        "timestamp": 1579236511186,
        "duration": 13
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001300c2-0013-0091-0076-0048005c0084.png",
        "timestamp": 1579236511855,
        "duration": 34
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 232,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected false to be truthy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:77:36)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00dc00a5-00f7-0082-0028-006a00380028.png",
        "timestamp": 1579236512589,
        "duration": 20
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003d001b-0087-00e3-0052-0080005f0053.png",
        "timestamp": 1579236689385,
        "duration": 8
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000f0043-00c7-0017-001f-0044006b0084.png",
        "timestamp": 1579236689947,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001e0010-00db-00a3-006f-0003009a0021.png",
        "timestamp": 1579236690145,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c002f-0025-00d3-00e3-00a100a600c4.png",
        "timestamp": 1579236690395,
        "duration": 67
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579236690632,
                "type": ""
            }
        ],
        "screenShotFile": "000600ab-0095-0089-0075-0032005a00fc.png",
        "timestamp": 1579236691378,
        "duration": 20
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000900a0-00f1-0083-008b-009800e30024.png",
        "timestamp": 1579236692078,
        "duration": 33
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00470064-00bd-00c3-00ab-007600f100d9.png",
        "timestamp": 1579236692828,
        "duration": 18
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12592,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0089000b-00e9-00c3-008b-00a00011009e.png",
        "timestamp": 1579236693553,
        "duration": 19
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00150038-0060-00bd-00e2-00f400c5009a.png",
        "timestamp": 1579236843009,
        "duration": 22
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00c200c1-006e-0044-00b5-003800d20018.png",
        "timestamp": 1579236843768,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a80024-0002-00b0-00a4-001f00410024.png",
        "timestamp": 1579236844022,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579236844296,
                "type": ""
            }
        ],
        "screenShotFile": "00fa00c1-00d0-00c0-005d-00f9009c0064.png",
        "timestamp": 1579236844244,
        "duration": 38
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00990056-008c-000e-0065-00f9006800e6.png",
        "timestamp": 1579236844958,
        "duration": 33
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008700e6-0097-00c7-006f-00b700c000f1.png",
        "timestamp": 1579236845675,
        "duration": 35
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005c00dd-005d-0035-00dd-0099009b0034.png",
        "timestamp": 1579236846400,
        "duration": 18
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5228,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e7003c-0089-0045-0006-003a008e00f2.png",
        "timestamp": 1579236847130,
        "duration": 46
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00490086-000a-00a4-00a8-0033004c00c3.png",
        "timestamp": 1579236886918,
        "duration": 9
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d800a9-008c-007f-009c-002d00fa0057.png",
        "timestamp": 1579236887760,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00cc0043-00d3-00ea-00e7-00b6009800ae.png",
        "timestamp": 1579236888093,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579236888388,
                "type": ""
            }
        ],
        "screenShotFile": "00aa0009-0081-00bd-0037-00a100dc0038.png",
        "timestamp": 1579236888335,
        "duration": 41
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b00037-0026-00e3-0080-001600bc00cb.png",
        "timestamp": 1579236889093,
        "duration": 37
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b5008d-00e4-004f-0039-00cc0063008b.png",
        "timestamp": 1579236889796,
        "duration": 26
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009600a5-0001-0082-00b5-007a00540018.png",
        "timestamp": 1579236890597,
        "duration": 22
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Aditya' to contain 'dd'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:82:36)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "008b0079-00ab-001a-00a6-004400560064.png",
        "timestamp": 1579236891344,
        "duration": 45
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00510024-005f-0021-00ef-0098008900b8.png",
        "timestamp": 1579236935307,
        "duration": 6
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006200d0-00fb-0001-0091-00d5004d000e.png",
        "timestamp": 1579236936038,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579236936553,
                "type": ""
            }
        ],
        "screenShotFile": "002e00a2-0036-0073-00e8-0054009900de.png",
        "timestamp": 1579236936405,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f50022-0014-00c5-0013-0041002b0011.png",
        "timestamp": 1579236936754,
        "duration": 73
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0078003c-004c-00a2-008d-00ce005f009a.png",
        "timestamp": 1579236937412,
        "duration": 19
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00400023-0003-000b-0026-006300ac00fe.png",
        "timestamp": 1579236937946,
        "duration": 26
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00520092-000c-0004-00d2-00350045003d.png",
        "timestamp": 1579236938488,
        "duration": 13
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14236,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001300ed-00b8-00c1-0062-005f00070029.png",
        "timestamp": 1579236939043,
        "duration": 12
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00f80039-001d-001a-002a-008000110096.png",
        "timestamp": 1579237147832,
        "duration": 22
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0058006d-005d-006c-00a5-005a005b0068.png",
        "timestamp": 1579237148117,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004f00ba-001a-00f6-009e-003d00b200c5.png",
        "timestamp": 1579237148508,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d4002f-00c2-00dd-0031-00ec003b00c0.png",
        "timestamp": 1579237148784,
        "duration": 43
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579237149347,
                "type": ""
            }
        ],
        "screenShotFile": "00600043-008c-0080-00bd-002b008600ac.png",
        "timestamp": 1579237149459,
        "duration": 14
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00590035-0095-005e-00ef-00ab009500e0.png",
        "timestamp": 1579237150169,
        "duration": 24
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0087002b-007a-005b-00c3-00f00021001d.png",
        "timestamp": 1579237150914,
        "duration": 35
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9604,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a6009c-0003-0084-0074-00950082003f.png",
        "timestamp": 1579237151654,
        "duration": 32
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00da00b6-00b5-00d2-0027-0075007a00a7.png",
        "timestamp": 1579285499260,
        "duration": 8
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0039006d-00b7-00f1-0085-00a400d30082.png",
        "timestamp": 1579285499962,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008c00e2-0018-00cb-0088-007400810050.png",
        "timestamp": 1579285500226,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579285500791,
                "type": ""
            }
        ],
        "screenShotFile": "001b005c-0042-003f-0067-004800d200b8.png",
        "timestamp": 1579285500633,
        "duration": 65
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ad0094-002b-0052-003c-00ec0035002d.png",
        "timestamp": 1579285501738,
        "duration": 17
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b100c9-0039-0035-004b-009200f100c2.png",
        "timestamp": 1579285502366,
        "duration": 14
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a600dc-0074-003a-0023-008d003a0024.png",
        "timestamp": 1579285503167,
        "duration": 16
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14504,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f20089-002a-0084-005b-00f200ff00a0.png",
        "timestamp": 1579285503874,
        "duration": 63
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0085004d-0054-009a-0032-007900060070.png",
        "timestamp": 1579285550014,
        "duration": 11
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ec009e-0080-0048-00af-00cf008f0006.png",
        "timestamp": 1579285550669,
        "duration": 2
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579285551471,
                "type": ""
            }
        ],
        "screenShotFile": "002e00c0-00f9-00e4-0024-00d800b600f4.png",
        "timestamp": 1579285551354,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008d00db-00ac-006f-00e7-00c100aa00e7.png",
        "timestamp": 1579285551677,
        "duration": 68
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e00d7-008a-0056-0044-00e3001c0047.png",
        "timestamp": 1579285552441,
        "duration": 14
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00050008-002a-004b-0080-00ee002e0039.png",
        "timestamp": 1579285553231,
        "duration": 80
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dc007e-00fc-0031-00fb-001b009f00dd.png",
        "timestamp": 1579285554019,
        "duration": 38
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001100b7-005f-00ae-00f8-00fe00910095.png",
        "timestamp": 1579285554815,
        "duration": 46
    },
    {
        "description": "Should be able to load the Page|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b800c8-00ea-0021-008e-009300b50055.png",
        "timestamp": 1579285573783,
        "duration": 13
    },
    {
        "description": "Page title should be valid|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005a007f-007d-00ce-0061-000800830078.png",
        "timestamp": 1579285574426,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Load the URL",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000100a8-00b7-0091-00af-0080005500c5.png",
        "timestamp": 1579285574756,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579285575034,
                "type": ""
            }
        ],
        "screenShotFile": "00ec003e-0035-006d-00de-0024008a0053.png",
        "timestamp": 1579285574992,
        "duration": 32
    },
    {
        "description": "Checking toBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00190041-0092-006d-009f-006e006d00ff.png",
        "timestamp": 1579285575524,
        "duration": 9
    },
    {
        "description": "Checking NotToEqual() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da0099-00a0-002c-00ac-007300520084.png",
        "timestamp": 1579285576065,
        "duration": 36
    },
    {
        "description": "Checking NotToBe() method|Load the URL",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cd0022-004c-0005-00fa-00d000770005.png",
        "timestamp": 1579285576603,
        "duration": 11
    },
    {
        "description": "Checking other() method|Load the URL",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5204,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected null to be undefined."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:95:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "009f00d0-007f-0053-0061-00b800b2004b.png",
        "timestamp": 1579285577092,
        "duration": 20
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e600f9-007f-0029-0072-009100790093.png",
        "timestamp": 1579287446765,
        "duration": 1108
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579287448274,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579287448793,
                "type": ""
            }
        ],
        "screenShotFile": "00ee009e-0013-00b6-00c0-00a200f20085.png",
        "timestamp": 1579287448561,
        "duration": 710
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579287449973,
                "type": ""
            }
        ],
        "screenShotFile": "009a0099-00b6-0094-002f-0093009100f2.png",
        "timestamp": 1579287449786,
        "duration": 8593
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5256,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b000e2-00fe-0071-00e0-0049002900a8.png",
        "timestamp": 1579287547423,
        "duration": 1416
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5256,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579287549094,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579287549684,
                "type": ""
            }
        ],
        "screenShotFile": "001a007a-00e9-00d5-0031-006c00f5006f.png",
        "timestamp": 1579287549513,
        "duration": 597
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5256,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "007000f7-000b-00cb-008a-00cd008d00a3.png",
        "timestamp": 1579287550615,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0077004b-00f8-005d-0028-00c2006b0006.png",
        "timestamp": 1579287807293,
        "duration": 9
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006a005e-0045-008b-00df-004c0059005e.png",
        "timestamp": 1579287808001,
        "duration": 0
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004500a0-000d-00f4-00b7-00f600be0046.png",
        "timestamp": 1579287808282,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579287808592,
                "type": ""
            }
        ],
        "screenShotFile": "000e0082-0001-0019-0024-004100410048.png",
        "timestamp": 1579287808554,
        "duration": 25
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c200fa-0042-0040-00b5-0019000800af.png",
        "timestamp": 1579287809242,
        "duration": 52
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec00ef-00d7-0008-00b9-00de003e007b.png",
        "timestamp": 1579287810149,
        "duration": 44
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009d0076-0020-0042-009b-00fb00bc0007.png",
        "timestamp": 1579287810967,
        "duration": 17
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1540,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 2 to be null."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:96:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "0032007b-006c-0008-003b-003c00290095.png",
        "timestamp": 1579287811746,
        "duration": 71
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00310099-00e2-00bb-00a4-002d00400098.png",
        "timestamp": 1579287872762,
        "duration": 19
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008300fd-0022-00ff-00eb-001b008200af.png",
        "timestamp": 1579287873460,
        "duration": 1
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00df0012-0026-00b0-0041-0096006200c0.png",
        "timestamp": 1579287873747,
        "duration": 0
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579287874021,
                "type": ""
            }
        ],
        "screenShotFile": "001a00e1-0036-0036-008f-002d00730044.png",
        "timestamp": 1579287873979,
        "duration": 35
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00760086-007c-005e-00b5-00ca002e004b.png",
        "timestamp": 1579287874716,
        "duration": 54
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c0053-00c9-0013-008f-006d001000a4.png",
        "timestamp": 1579287875648,
        "duration": 25
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002200c1-00e1-0094-009e-00e0000600e7.png",
        "timestamp": 1579287876448,
        "duration": 20
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5612,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Aditya' to contain 'x'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC01_Load&Validate_Page.js:82:36)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00fe000f-00da-009a-0018-008e00c500aa.png",
        "timestamp": 1579287877197,
        "duration": 96
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579539248091,
                "type": ""
            }
        ],
        "screenShotFile": "0034009c-00be-00c7-0036-00bf005700a5.png",
        "timestamp": 1579539245348,
        "duration": 11430
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00f60083-0063-00af-00bb-007b0033004a.png",
        "timestamp": 1579539258403,
        "duration": 1
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00190093-0010-001f-00aa-00290066007e.png",
        "timestamp": 1579539258718,
        "duration": 1
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ce0016-0012-008e-007d-00e5000d00f9.png",
        "timestamp": 1579539258908,
        "duration": 1
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005e00d4-0096-0056-00fe-00a2002000ab.png",
        "timestamp": 1579539259162,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00c60002-00f0-003f-00cb-000a00d200c9.png",
        "timestamp": 1579539259363,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00310017-0040-002e-0078-00a800ae00df.png",
        "timestamp": 1579539259529,
        "duration": 1
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005b00f3-0089-003d-00f2-001d00aa0048.png",
        "timestamp": 1579539259707,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00890006-00a1-00bc-00e4-0094001c00db.png",
        "timestamp": 1579539908884,
        "duration": 530
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579539910220,
                "type": ""
            }
        ],
        "screenShotFile": "00dd00ac-001a-000d-00df-006000e4006c.png",
        "timestamp": 1579539910698,
        "duration": 81
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004b00af-00db-000d-00a0-0095000e0078.png",
        "timestamp": 1579539911435,
        "duration": 7871
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005b00be-0008-003a-00ad-0015003600c0.png",
        "timestamp": 1579539920047,
        "duration": 1
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004f002b-0082-00c3-006d-00aa00e80093.png",
        "timestamp": 1579539920237,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "009e0055-0011-00ac-00b8-0045005800bc.png",
        "timestamp": 1579539920543,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00480041-0088-0073-000b-004500db00c8.png",
        "timestamp": 1579539920722,
        "duration": 1
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 7524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002d00c8-00d5-0062-000b-00e600290011.png",
        "timestamp": 1579539920885,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0006004e-0099-0075-00b4-0035003100e7.png",
        "timestamp": 1579540632616,
        "duration": 892
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579540633982,
                "type": ""
            }
        ],
        "screenShotFile": "005300d4-0009-00a1-0064-00ad004000ab.png",
        "timestamp": 1579540634259,
        "duration": 67
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006800e9-0062-0093-0082-00e000e200e5.png",
        "timestamp": 1579540634899,
        "duration": 7610
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002900e8-007b-00ea-0072-00000001004a.png",
        "timestamp": 1579540643373,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000c006e-00b0-00b5-00fa-008700e100ab.png",
        "timestamp": 1579540643648,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00c400ce-003c-00ce-0096-0010009b00a5.png",
        "timestamp": 1579540644068,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006c006e-00a6-0082-007e-00b40050009b.png",
        "timestamp": 1579540644325,
        "duration": 1
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00030067-00f6-00e7-0021-00e9007000d6.png",
        "timestamp": 1579540644559,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14284,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c400e8-00c4-0022-0048-002e001c003b.png",
        "timestamp": 1579542388929,
        "duration": 2560
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4664,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b600c5-006b-0021-0045-00c5004c0080.png",
        "timestamp": 1579542462088,
        "duration": 1666
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12536,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0051008d-007b-00f8-0029-001500c200ad.png",
        "timestamp": 1579542533920,
        "duration": 1484
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12124,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00030048-00d5-0039-00b3-0018009e0030.png",
        "timestamp": 1579542556856,
        "duration": 1659
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7472,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b5005a-00b2-00c6-008d-008a007400ed.png",
        "timestamp": 1579542650790,
        "duration": 1492
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13440,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579542712084,
                "type": ""
            }
        ],
        "screenShotFile": "004b00c8-0090-0057-00aa-000700fb0057.png",
        "timestamp": 1579542709250,
        "duration": 2574
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6992,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e008c-0020-00c5-00e7-0029001300de.png",
        "timestamp": 1579542788276,
        "duration": 1747
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13952,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579542813592,
                "type": ""
            }
        ],
        "screenShotFile": "0088001a-006e-0020-00d3-003a007f0030.png",
        "timestamp": 1579542811652,
        "duration": 1752
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00980026-0003-00f1-0093-00a600670051.png",
        "timestamp": 1579543151141,
        "duration": 626
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6416,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b0041-0096-006f-001a-00dd009700ad.png",
        "timestamp": 1579543206037,
        "duration": 887
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ce0092-002b-00b1-00c8-002500c00030.png",
        "timestamp": 1579543251273,
        "duration": 770
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12192,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ca0025-00f4-0082-0072-00250071003c.png",
        "timestamp": 1579543302242,
        "duration": 601
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00230026-006a-0055-00ab-00e0007a0007.png",
        "timestamp": 1579543398481,
        "duration": 558
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6968,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f50011-00ae-0019-00b1-0042001200d4.png",
        "timestamp": 1579543457063,
        "duration": 858
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7620,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec00c3-00d9-00f1-00d2-004a001d0099.png",
        "timestamp": 1579543520842,
        "duration": 551
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc0025-00e6-0036-0055-003900440067.png",
        "timestamp": 1579543606362,
        "duration": 1225
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8608,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0087004c-0080-0066-00e0-0008005f00f2.png",
        "timestamp": 1579544194944,
        "duration": 815
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14772,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579544412868,
                "type": ""
            }
        ],
        "screenShotFile": "005200db-0066-005c-0084-00fd004f0071.png",
        "timestamp": 1579544411077,
        "duration": 1524
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13024,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e4005c-00dd-00f9-0047-005f00a4007f.png",
        "timestamp": 1579544507878,
        "duration": 1220
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9520,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d300f5-008e-00d4-0092-00ef002a00b8.png",
        "timestamp": 1579544567938,
        "duration": 836
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12808,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ca00bb-00b7-0079-0022-002700ac0027.png",
        "timestamp": 1579544633092,
        "duration": 700
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6288,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d5001e-00fd-00c9-0077-003c008c0076.png",
        "timestamp": 1579544717814,
        "duration": 371
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 9012,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e70038-00ac-0095-0006-00b100bd00c8.png",
        "timestamp": 1579544848021,
        "duration": 1253
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 760,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001300f6-00df-00e6-004b-000200430061.png",
        "timestamp": 1579544885653,
        "duration": 844
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14200,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579545163843,
                "type": ""
            }
        ],
        "screenShotFile": "00670035-0055-0050-007d-0099003c0065.png",
        "timestamp": 1579545162140,
        "duration": 1437
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5584,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005400b1-0059-004c-001e-00d3007a0073.png",
        "timestamp": 1579545209337,
        "duration": 996
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e9008c-00a7-0095-0091-009c001500bb.png",
        "timestamp": 1579545292709,
        "duration": 737
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11524,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009900ac-006d-009d-00a4-004f00b400be.png",
        "timestamp": 1579545514240,
        "duration": 834
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 13460,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0003001a-00ea-0039-00b7-00ac00fb004a.png",
        "timestamp": 1579545620884,
        "duration": 682
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3420,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b00050-00f1-00f1-002b-005f0011008c.png",
        "timestamp": 1579545712704,
        "duration": 660
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15076,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579545836467,
                "type": ""
            }
        ],
        "screenShotFile": "00d300c8-00b5-00e6-0018-00ef002000eb.png",
        "timestamp": 1579545835025,
        "duration": 1148
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6020,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a000b2-004d-0007-0002-008c00eb008f.png",
        "timestamp": 1579545870903,
        "duration": 792
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14680,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579545907499,
                "type": ""
            }
        ],
        "screenShotFile": "002a004f-009a-00a7-0058-0079009300df.png",
        "timestamp": 1579545901539,
        "duration": 5861
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12056,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579545964007,
                "type": ""
            }
        ],
        "screenShotFile": "0049000d-000d-00c8-00ad-008500ac002a.png",
        "timestamp": 1579545958307,
        "duration": 5626
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3568,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579545994558,
                "type": ""
            }
        ],
        "screenShotFile": "0043000b-0082-0081-0064-000f002000b0.png",
        "timestamp": 1579545988643,
        "duration": 5869
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7876,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579546058128,
                "type": ""
            }
        ],
        "screenShotFile": "00f300de-00bc-00bf-00cb-006000f000cc.png",
        "timestamp": 1579546042344,
        "duration": 15714
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 11408,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579546230187,
                "type": ""
            }
        ],
        "screenShotFile": "0036002e-00fb-0074-00d9-00ca002900af.png",
        "timestamp": 1579546154546,
        "duration": 75588
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 17024,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.117)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)",
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.117)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.117)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchWindowError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:216:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Protractor.get(https://www.protractortest.org/) - get url\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeScriptWithDescription (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:404:28)\n    at driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:686:29)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:938:14\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: waiting for page to load for 10000ms\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at driver.controlFlow.execute.then.then.then.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:685:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\Test Environment\\Environment.js:8:5)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\Test Environment\\Environment.js:6:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.117)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchWindowError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:216:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Protractor.waitForAngular()\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\Test Environment\\Environment.js:26:13)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\Test Environment\\Environment.js:6:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "timestamp": 1579718206661,
        "duration": 93
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10900,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.117"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d60002-00de-0021-0098-00b10083005f.png",
        "timestamp": 1579718248198,
        "duration": 18828
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: starttime is not defined",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "ReferenceError: starttime is not defined\n    at UserContext.beforeAll (C:\\ProtractorAutomation\\Configuration\\protractor.config.js:32:33)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at TreeProcessor.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5187:7)\n    at Env.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:983:17)\n    at Jasmine.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine\\lib\\jasmine.js:200:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\frameworks\\jasmine.js:132:15\n    at Function.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:682:9)\nFrom asynchronous test: \nError\n    at onPrepare (C:\\ProtractorAutomation\\Configuration\\protractor.config.js:30:14)\n    at q_1.Promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\util.js:46:49)\n    at Function.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:682:9)\n    at Object.runFilenameOrFn_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\util.js:38:16)\n    at plugins_.onPrepare.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\runner.js:98:27)\n    at _fulfilled (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:834:54)\n    at self.promiseDispatch.done (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:863:30)\n    at Promise.promise.promiseDispatch (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:796:13)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:556:49",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:11:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f10088-0042-00d1-00da-00bc00c900a3.png",
        "timestamp": 1579720800715,
        "duration": 122
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: starttime is not defined",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "ReferenceError: starttime is not defined\n    at UserContext.beforeAll (C:\\ProtractorAutomation\\Configuration\\protractor.config.js:32:33)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at TreeProcessor.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5187:7)\n    at Env.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:983:17)\n    at Jasmine.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine\\lib\\jasmine.js:200:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\frameworks\\jasmine.js:132:15\n    at Function.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:682:9)\nFrom asynchronous test: \nError\n    at onPrepare (C:\\ProtractorAutomation\\Configuration\\protractor.config.js:30:14)\n    at q_1.Promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\util.js:46:49)\n    at Function.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:682:9)\n    at Object.runFilenameOrFn_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\util.js:38:16)\n    at plugins_.onPrepare.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\runner.js:98:27)\n    at _fulfilled (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:834:54)\n    at self.promiseDispatch.done (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:863:30)\n    at Promise.promise.promiseDispatch (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:796:13)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:556:49",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Page title should be valid\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:16:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007b00f8-00e3-00ea-001a-00c500dc007c.png",
        "timestamp": 1579720801776,
        "duration": 76
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: starttime is not defined",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "ReferenceError: starttime is not defined\n    at UserContext.beforeAll (C:\\ProtractorAutomation\\Configuration\\protractor.config.js:32:33)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at TreeProcessor.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5187:7)\n    at Env.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:983:17)\n    at Jasmine.execute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine\\lib\\jasmine.js:200:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\frameworks\\jasmine.js:132:15\n    at Function.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:682:9)\nFrom asynchronous test: \nError\n    at onPrepare (C:\\ProtractorAutomation\\Configuration\\protractor.config.js:30:14)\n    at q_1.Promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\util.js:46:49)\n    at Function.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:682:9)\n    at Object.runFilenameOrFn_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\util.js:38:16)\n    at plugins_.onPrepare.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\runner.js:98:27)\n    at _fulfilled (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:834:54)\n    at self.promiseDispatch.done (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:863:30)\n    at Promise.promise.promiseDispatch (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:796:13)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\q\\q.js:556:49",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:22:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:21:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00870093-0018-0065-0099-00f200a5007d.png",
        "timestamp": 1579720802481,
        "duration": 54
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00af00f1-00b1-0036-0023-006500b70025.png",
        "timestamp": 1579720803176,
        "duration": 1
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002f008f-005f-00dc-0017-0088006b0048.png",
        "timestamp": 1579720803352,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008f00c7-0089-0034-0017-006300240057.png",
        "timestamp": 1579720803579,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00310096-00b8-003d-0026-000c005800ca.png",
        "timestamp": 1579720803768,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14432,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ff0041-00d8-002d-00af-00aa0002008d.png",
        "timestamp": 1579720803915,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0036009c-002f-0099-006f-000b00260048.png",
        "timestamp": 1579720840214,
        "duration": 980
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579720841848,
                "type": ""
            }
        ],
        "screenShotFile": "0062009a-00fd-0039-0061-00c6009d0086.png",
        "timestamp": 1579720842582,
        "duration": 87
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00060022-003f-0056-0046-00d400d7005e.png",
        "timestamp": 1579720843500,
        "duration": 8205
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006b0066-0043-00fa-00d7-000000bc00a4.png",
        "timestamp": 1579720852535,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00da003d-00f0-0042-000c-002e009d009f.png",
        "timestamp": 1579720852853,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008900ed-008e-0049-0087-00fb00260056.png",
        "timestamp": 1579720853097,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0050006e-00e6-00e0-00bc-00ce0048005d.png",
        "timestamp": 1579720853305,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00f2007f-0021-0041-0059-000c00c30039.png",
        "timestamp": 1579720853510,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e0061-0049-0083-0081-00a100520033.png",
        "timestamp": 1579721388415,
        "duration": 663
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579721390251,
                "type": ""
            }
        ],
        "screenShotFile": "00e800a2-006c-0008-00a4-00a900f80073.png",
        "timestamp": 1579721390220,
        "duration": 247
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000700e8-00bf-00d4-0063-001f00fc0064.png",
        "timestamp": 1579721391544,
        "duration": 8137
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b1007e-00d5-0079-008d-007e00fe0044.png",
        "timestamp": 1579721400509,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ff0046-007f-0068-00a1-006900180025.png",
        "timestamp": 1579721400761,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005500ed-0047-00a3-009d-000a00980009.png",
        "timestamp": 1579721401106,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001700cc-0045-004f-00e7-003500a30086.png",
        "timestamp": 1579721401329,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 17356,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001a0003-00cf-0002-00c2-00a5007d00a6.png",
        "timestamp": 1579721401542,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002f0084-0001-0063-0029-001100a9005c.png",
        "timestamp": 1579721431256,
        "duration": 598
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1579721432317,
                "type": ""
            }
        ],
        "screenShotFile": "000e0040-004b-00c1-0098-001d00570097.png",
        "timestamp": 1579721432892,
        "duration": 92
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00450099-00ea-00de-00eb-00c7001400b0.png",
        "timestamp": 1579721433730,
        "duration": 8079
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001e004e-00ed-00bb-0056-00eb0094003e.png",
        "timestamp": 1579721442641,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003e0094-00da-009d-0087-00af00ff00a5.png",
        "timestamp": 1579721442868,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005c00a8-006d-007b-00f8-00ef007800f5.png",
        "timestamp": 1579721443192,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0013009c-002f-0005-00a5-000e002300d0.png",
        "timestamp": 1579721443428,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 8868,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008300ce-00f6-000d-0017-00f900cc00e6.png",
        "timestamp": 1579721443640,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:13:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c7009c-0018-00a9-00f5-004c00290038.png",
        "timestamp": 1580657986824,
        "duration": 242
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Page title should be valid\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:19:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "001200b7-002e-00f5-00f9-00ae001c00b1.png",
        "timestamp": 1580657989325,
        "duration": 83
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:25:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ad007c-00ac-00fc-0054-00ca00c7003b.png",
        "timestamp": 1580657990069,
        "duration": 84
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00f30047-00dc-00d2-006e-0000009500d5.png",
        "timestamp": 1580657990864,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "007b009c-0042-00b1-0065-0072009700bc.png",
        "timestamp": 1580657991067,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003d007b-001a-00c1-000a-0063002f00c0.png",
        "timestamp": 1580657991346,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0075005e-005f-0088-00ad-0024009100e9.png",
        "timestamp": 1580657991599,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12636,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000d001a-0048-00f5-00a0-00f5007400ca.png",
        "timestamp": 1580657991823,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:13:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "001b0040-007e-000a-00ed-00a100f50058.png",
        "timestamp": 1580658064462,
        "duration": 96
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Page title should be valid\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:20:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006500d5-00b5-0026-00f3-00c3005a00ad.png",
        "timestamp": 1580658065286,
        "duration": 52
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00000074-00ce-00e8-0094-0019004b00c5.png",
        "timestamp": 1580658065874,
        "duration": 75
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001a002e-00c8-00fa-0072-004e00f80043.png",
        "timestamp": 1580658066503,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a00089-00f9-0018-0040-0087008600b5.png",
        "timestamp": 1580658066671,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0077005d-00be-007c-0049-003b00e100a3.png",
        "timestamp": 1580658066891,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b80003-002d-007e-00e8-00f50016002e.png",
        "timestamp": 1580658067058,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15336,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00060041-000e-004f-0027-00e1001d009d.png",
        "timestamp": 1580658067270,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:13:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00480012-00f6-00ea-0041-00300051009a.png",
        "timestamp": 1580658109268,
        "duration": 104
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Page title should be valid\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:20:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ed00c8-006d-0092-0097-0001008100b5.png",
        "timestamp": 1580658110124,
        "duration": 47
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00170091-0064-003c-00b2-0089008e0038.png",
        "timestamp": 1580658110720,
        "duration": 62
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ab00a2-009f-0079-00ad-00740076001b.png",
        "timestamp": 1580658111354,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0012008a-0070-0004-0053-005600fe008e.png",
        "timestamp": 1580658111530,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e200fd-000c-0002-009c-002a0074002f.png",
        "timestamp": 1580658111732,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0080003c-0075-0033-000a-005e00b000de.png",
        "timestamp": 1580658111856,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18532,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002f0050-0052-0069-007a-003c0078003a.png",
        "timestamp": 1580658111979,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:13:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "002600ac-00c3-00ec-0055-002600000092.png",
        "timestamp": 1580658145873,
        "duration": 166
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Page title should be valid\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:20:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e900ed-0029-0061-0083-001100470097.png",
        "timestamp": 1580658147174,
        "duration": 70
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00850076-0004-0070-00e4-005f00b70001.png",
        "timestamp": 1580658147984,
        "duration": 108
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005300f8-003d-0047-00b6-0050006b0004.png",
        "timestamp": 1580658149301,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00aa0079-0021-0098-00b4-007300e500c7.png",
        "timestamp": 1580658149791,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003600f3-00d3-0068-00d1-00de00ca00ff.png",
        "timestamp": 1580658150059,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a500de-006b-00d2-002c-0030000c001e.png",
        "timestamp": 1580658150304,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 19580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e90051-00ed-0066-0062-00d8004b00f3.png",
        "timestamp": 1580658150499,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected 'data:,' to contain 'https://www.protractortest.org'."
        ],
        "trace": [
            "Error: Failed expectation\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:17:29)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "001c0001-0012-0015-005f-00c8009f0074.png",
        "timestamp": 1580658435013,
        "duration": 105
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected '' to be 'Protractor - end-to-end testing for AngularJS'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:24:39\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00800089-0056-00d5-007c-00f000fc0044.png",
        "timestamp": 1580658436106,
        "duration": 80
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Wait timed out after 10012ms"
        ],
        "trace": [
            "TimeoutError: Wait timed out after 10012ms\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at TimeoutError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:262:5)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2201:17\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006100a5-00a2-0024-0097-0006008a00d7.png",
        "timestamp": 1580658436993,
        "duration": 10105
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b700f6-00d5-0043-0026-009e009400bf.png",
        "timestamp": 1580658448219,
        "duration": 1
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0034004f-005e-00ea-007d-00df005300cf.png",
        "timestamp": 1580658448445,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002c00ee-008c-00db-0007-00ba00b3007c.png",
        "timestamp": 1580658448656,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ca000d-00e2-0057-0029-005400ce000b.png",
        "timestamp": 1580658448915,
        "duration": 1
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 15148,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00f8000d-0026-009a-00ba-00a9001d00f6.png",
        "timestamp": 1580658449211,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:13:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d70031-0098-00a0-00e1-004d00530099.png",
        "timestamp": 1580658520380,
        "duration": 180
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Page title should be valid\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:20:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bd00de-00d8-0032-005b-0025005500da.png",
        "timestamp": 1580658522121,
        "duration": 59
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00680003-0020-00ef-005f-00e800340033.png",
        "timestamp": 1580658522937,
        "duration": 94
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b60094-0033-0099-008e-00b400cc0042.png",
        "timestamp": 1580658523786,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00c00086-00d2-00c1-00e1-0041005700e1.png",
        "timestamp": 1580658524164,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e300c3-00dd-008f-00d7-00c2001800fb.png",
        "timestamp": 1580658524403,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003d00b4-0033-0077-004c-000500a100ab.png",
        "timestamp": 1580658524679,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 5840,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e700f1-001b-0091-00c9-008600860053.png",
        "timestamp": 1580658524900,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected 'data:,' to contain 'https://www.protractortest.org'."
        ],
        "trace": [
            "Error: Failed expectation\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:17:29)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00900007-002a-0045-0088-006d0083003b.png",
        "timestamp": 1580658549313,
        "duration": 151
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected '' to be 'Protractor - end-to-end testing for AngularJS'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:24:39\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fc0031-00b5-00c5-003a-00aa00cc003e.png",
        "timestamp": 1580658550415,
        "duration": 55
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Wait timed out after 10006ms"
        ],
        "trace": [
            "TimeoutError: Wait timed out after 10006ms\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at TimeoutError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:262:5)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2201:17\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ed00c6-0072-0021-001f-008e0031001c.png",
        "timestamp": 1580658551206,
        "duration": 10057
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002c0001-0011-0018-00a6-001e005c009a.png",
        "timestamp": 1580658562283,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00280089-009e-00db-00d7-008200930015.png",
        "timestamp": 1580658562685,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000d00e5-0045-0082-0046-003e00e9001b.png",
        "timestamp": 1580658562961,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a3007e-0002-0080-0023-00ee007b0078.png",
        "timestamp": 1580658563213,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 14692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004600fa-0057-00a1-007b-00eb00220045.png",
        "timestamp": 1580658563642,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected 'data:,' to contain 'https://www.protractortest.org'."
        ],
        "trace": [
            "Error: Failed expectation\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:16:29)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ef005f-00cc-00a9-004b-00d7006800d7.png",
        "timestamp": 1580659194681,
        "duration": 208
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected '' to be 'Protractor - end-to-end testing for AngularJS'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:22:39\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00050033-00aa-000d-00ab-007d007e006a.png",
        "timestamp": 1580659198331,
        "duration": 182
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Wait timed out after 10014ms"
        ],
        "trace": [
            "TimeoutError: Wait timed out after 10014ms\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at TimeoutError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:262:5)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2201:17\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:27:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:25:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008400c9-00cc-007b-00b6-003f00850045.png",
        "timestamp": 1580659199770,
        "duration": 11080
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005d00cb-00ce-0029-002d-00e900400021.png",
        "timestamp": 1580659212360,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00240051-002b-0028-00aa-00a4008a008e.png",
        "timestamp": 1580659213137,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000c00b7-00dc-0019-0092-005400d20074.png",
        "timestamp": 1580659213668,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000a00be-0079-0007-006a-007c00f3002f.png",
        "timestamp": 1580659213952,
        "duration": 1
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 3596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ce00da-009d-00a2-0097-0010007a0088.png",
        "timestamp": 1580659214520,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580663101614,
                "type": ""
            }
        ],
        "screenShotFile": "00540070-002a-0078-0011-001200da009d.png",
        "timestamp": 1580663099201,
        "duration": 2403
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007700af-003a-0047-0083-0041008000b1.png",
        "timestamp": 1580663104437,
        "duration": 57
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.130)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.130)\n  (Driver info: chromedriver=78.0.3904.105 (60e2d8774a8151efa6a00b1f358371b1e0e07ee2-refs/branch-heads/3904@{#877}),platform=Windows NT 10.0.14393 x86_64)\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at NoSuchWindowError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:216:5)\n    at Object.checkLegacyResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //*[contains(text(),'Protractor Setup')])\n    at Driver.schedule (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:23:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:22:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\tc01_navigate to setup.js:9:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "timestamp": 1580663104943,
        "duration": 44
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b3008f-00f0-00e5-0024-0072006600a1.png",
        "timestamp": 1580663105248,
        "duration": 0
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000b00bb-002a-0089-0016-00ac004500e0.png",
        "timestamp": 1580663105401,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00e50090-006a-00f7-0037-008000be0024.png",
        "timestamp": 1580663105564,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00ec007e-0065-00dc-00f2-005e001a0022.png",
        "timestamp": 1580663105765,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18176,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a100ad-0040-000b-0029-007600850040.png",
        "timestamp": 1580663105903,
        "duration": 0
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006900ad-005e-002d-0055-002400f80054.png",
        "timestamp": 1580663235577,
        "duration": 1147
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580663237323,
                "type": ""
            }
        ],
        "screenShotFile": "00870022-0079-00e9-00b8-001e005f00bb.png",
        "timestamp": 1580663237919,
        "duration": 69
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d7005e-0063-001d-0045-000200270057.png",
        "timestamp": 1580663238715,
        "duration": 7996
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004f0034-0005-00fc-00ad-006e00340008.png",
        "timestamp": 1580663247617,
        "duration": 1
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005e0073-00f4-0082-00fc-001000df00f1.png",
        "timestamp": 1580663247888,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00bb00f5-0005-0080-008a-00b8005100e4.png",
        "timestamp": 1580663248210,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00aa0072-00af-003f-00e3-001e009900bb.png",
        "timestamp": 1580663248485,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 12072,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000c00da-0066-0010-002d-00fd00ef00bf.png",
        "timestamp": 1580663248844,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00970070-00b1-003c-007c-00990004001c.png",
        "timestamp": 1580663553749,
        "duration": 701
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580663556124,
                "type": ""
            }
        ],
        "screenShotFile": "00b50080-00fd-00ad-0013-004500f7006e.png",
        "timestamp": 1580663555919,
        "duration": 191
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001e0098-00ac-000b-0082-006700580018.png",
        "timestamp": 1580663556921,
        "duration": 7866
    },
    {
        "description": "Checking toEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0079007c-0015-00ac-00a1-0002001c00ae.png",
        "timestamp": 1580663565767,
        "duration": 1
    },
    {
        "description": "Checking toBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008f00a3-00e7-0065-0088-0040000f007b.png",
        "timestamp": 1580663566075,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "007a00e7-00f8-0066-0075-004c00cc00e9.png",
        "timestamp": 1580663566443,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d3002a-00f7-000f-00f7-003600230092.png",
        "timestamp": 1580663566690,
        "duration": 0
    },
    {
        "description": "Checking other() method|Testing the loading functionality",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00eb000d-00a6-0081-00e4-000300ea005e.png",
        "timestamp": 1580663567002,
        "duration": 1
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21112,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00530066-0034-006e-00a4-0003006000f8.png",
        "timestamp": 1580664858274,
        "duration": 869
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21112,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580664859685,
                "type": ""
            }
        ],
        "screenShotFile": "003c00ae-0078-004a-0069-00f900bf0086.png",
        "timestamp": 1580664860317,
        "duration": 82
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21112,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008800a4-00e2-0043-00d1-0058005000b4.png",
        "timestamp": 1580664861139,
        "duration": 4878
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21084,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00570057-0018-0027-002f-00e900e800e2.png",
        "timestamp": 1580665269872,
        "duration": 545
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21084,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665271143,
                "type": ""
            }
        ],
        "screenShotFile": "00e60091-00bc-0042-0054-002b00b60022.png",
        "timestamp": 1580665271704,
        "duration": 86
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21084,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009b00ff-007f-0089-00ca-00c300c000fd.png",
        "timestamp": 1580665272514,
        "duration": 4953
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19812,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004600a0-00b2-001e-008e-00d2007a009b.png",
        "timestamp": 1580665415704,
        "duration": 532
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19812,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665417301,
                "type": ""
            }
        ],
        "screenShotFile": "00ea0016-00ea-0069-003f-00f500dc00d3.png",
        "timestamp": 1580665417291,
        "duration": 52
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19812,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c20014-007a-00d9-00d1-002100be0061.png",
        "timestamp": 1580665418094,
        "duration": 5050
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8648,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Should be able to load the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:19:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:16:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e000d7-0093-0010-0094-0052000900c6.png",
        "timestamp": 1580665473951,
        "duration": 119
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8648,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: Run it(\"Page title should be valid\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:24:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:16:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00860058-00be-00e0-00df-0008007c0094.png",
        "timestamp": 1580665474988,
        "duration": 57
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8648,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at runWaitForAngularScript.then (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:463:23)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:29:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:16:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00890043-0018-00fc-00df-007a0014005b.png",
        "timestamp": 1580665475752,
        "duration": 56
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 20100,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected 'data:,' to contain 'https://www.protractortest.org'."
        ],
        "trace": [
            "Error: Failed expectation\n    at browser.getCurrentUrl.then (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:21:29)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00850068-00d9-00fd-00be-002300870068.png",
        "timestamp": 1580665514014,
        "duration": 93
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 20100,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Expected '' to be 'Protractor - end-to-end testing for AngularJS'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:26:39\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "002b0030-00cb-00f4-00c6-00eb00e2000d.png",
        "timestamp": 1580665515023,
        "duration": 34
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 20100,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": [
            "Failed: Wait timed out after 10008ms"
        ],
        "trace": [
            "TimeoutError: Wait timed out after 10008ms\n    at WebDriverError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:27:5)\n    at TimeoutError (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:262:5)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2201:17\n    at ManagedPromise.invokeCallback_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:109:7)\nFrom: Task: <anonymous wait>\n    at scheduleWait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at Driver.wait (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:30:21)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run it(\"Should be able to choose framework option from Protractor Set up\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:29:9)\n    at addSpecsToSuite (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\Laptop\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\ProtractorAutomation\\TestScript\\TC02_ProtractortestORG_Validation.js:16:1)\n    at Module._compile (module.js:570:32)\n    at Object.Module._extensions..js (module.js:579:10)\n    at Module.load (module.js:487:32)\n    at tryModuleLoad (module.js:446:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "009d0023-00dc-0033-00c7-001000ea006a.png",
        "timestamp": 1580665515709,
        "duration": 10037
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5208,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ca004b-0044-0061-007b-0013000000df.png",
        "timestamp": 1580665550081,
        "duration": 2724
    },
    {
        "description": "Page title should be valid|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5208,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665554143,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665554493,
                "type": ""
            }
        ],
        "screenShotFile": "00160092-00ce-0035-0057-00620054005b.png",
        "timestamp": 1580665554125,
        "duration": 1240
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5208,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665556460,
                "type": ""
            }
        ],
        "screenShotFile": "007200bd-00ed-00c4-00c4-00460004007b.png",
        "timestamp": 1580665556217,
        "duration": 5823
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006800b7-00d0-009a-0081-0077006c00c2.png",
        "timestamp": 1580665666511,
        "duration": 1766
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19848,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665668786,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665669461,
                "type": ""
            }
        ],
        "screenShotFile": "001a00e9-0032-0015-00db-000f00f40090.png",
        "timestamp": 1580665669212,
        "duration": 5695
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d800eb-00aa-0001-00c4-00d3003c0039.png",
        "timestamp": 1580665780259,
        "duration": 1951
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 19692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665782561,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665783516,
                "type": ""
            }
        ],
        "screenShotFile": "00c900f1-0016-009b-0009-002e00110026.png",
        "timestamp": 1580665783222,
        "duration": 5763
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15736,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f100a0-007b-00a5-007e-006800430008.png",
        "timestamp": 1580665898713,
        "duration": 3080
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15736,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665902072,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580665903409,
                "type": ""
            }
        ],
        "screenShotFile": "005a00a7-0093-00b2-00b1-0036000b0000.png",
        "timestamp": 1580665903112,
        "duration": 6031
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00070058-005a-0027-008c-00c9007300c9.png",
        "timestamp": 1580666124891,
        "duration": 2402
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 8,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666128668,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666128995,
                "type": ""
            }
        ],
        "screenShotFile": "006500b5-0054-00b4-0065-0097005100cc.png",
        "timestamp": 1580666128653,
        "duration": 6364
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6400,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0029006e-00e0-0064-0085-00bd00220072.png",
        "timestamp": 1580666196859,
        "duration": 1490
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6400,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666198611,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666199359,
                "type": ""
            }
        ],
        "screenShotFile": "00f60061-0043-0061-003c-00940089002a.png",
        "timestamp": 1580666199124,
        "duration": 5659
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21188,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666311333,
                "type": ""
            }
        ],
        "screenShotFile": "00380027-0038-001c-0079-003c00b500da.png",
        "timestamp": 1580666309243,
        "duration": 2128
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 21188,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666312933,
                "type": ""
            }
        ],
        "screenShotFile": "004a0061-0093-001b-00d5-00b700560072.png",
        "timestamp": 1580666312596,
        "duration": 6657
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12312,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00940027-0019-0027-000d-003900360040.png",
        "timestamp": 1580666675799,
        "duration": 1746
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 12312,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666678105,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666680680,
                "type": ""
            }
        ],
        "screenShotFile": "001600eb-005c-00b3-00e7-00cb00d700c6.png",
        "timestamp": 1580666678541,
        "duration": 7438
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10212,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0050009d-002e-000b-0068-000700750032.png",
        "timestamp": 1580666820940,
        "duration": 2133
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 10212,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666823291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580666824929,
                "type": ""
            }
        ],
        "screenShotFile": "00910030-008e-00ab-008b-00c900930091.png",
        "timestamp": 1580666824596,
        "duration": 7307
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18864,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f00084-00d3-0009-005c-009000870043.png",
        "timestamp": 1580667611606,
        "duration": 1330
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18864,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580667613431,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580667614286,
                "type": ""
            }
        ],
        "screenShotFile": "006e00d0-000b-0029-00cb-0076004f0098.png",
        "timestamp": 1580667613918,
        "duration": 6711
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18864,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000200cc-0043-00b8-002d-008500270058.png",
        "timestamp": 1580667621629,
        "duration": 4
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18864,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00710052-00b2-001a-0008-002400be00ae.png",
        "timestamp": 1580667622018,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18864,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d7000a-007e-00b1-006b-00e2007f00e0.png",
        "timestamp": 1580667622259,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows NT",
        "instanceId": 18864,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006d0073-00e9-0020-00f8-005900670068.png",
        "timestamp": 1580667622495,
        "duration": 1
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 18864,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b900ed-0042-00a5-006b-0034006000b8.png",
        "timestamp": 1580667622763,
        "duration": 34
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15472,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f000e-0071-00da-0007-00e100b80031.png",
        "timestamp": 1580670404436,
        "duration": 1283
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 15472,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580670406160,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580670406791,
                "type": ""
            }
        ],
        "screenShotFile": "00ea007a-00dd-004b-0079-00c8009a00ce.png",
        "timestamp": 1580670406552,
        "duration": 6602
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 17428,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dc0054-0063-0037-0041-00a500d50034.png",
        "timestamp": 1580670518308,
        "duration": 1098
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 17428,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.protractortest.org/#/ - A cookie associated with a cross-site resource at http://twitter.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1580670519454,
                "type": ""
            }
        ],
        "screenShotFile": "00660023-0093-00ee-0017-00da007500be.png",
        "timestamp": 1580670520288,
        "duration": 5765
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0040001c-00fd-0065-00bc-007b007700cc.png",
        "timestamp": 1582198713823,
        "duration": 1683
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1924,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.130"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0069001f-0049-00ee-00e9-008100b10045.png",
        "timestamp": 1582198718556,
        "duration": 8207
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005d0058-0032-0054-004f-008f001000a3.png",
        "timestamp": 1584115908306,
        "duration": 1711
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00da00c4-00ea-005d-00e8-007000440048.png",
        "timestamp": 1584115912605,
        "duration": 6624
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1240,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b40039-0011-0062-00c5-0046007b00ff.png",
        "timestamp": 1584819203123,
        "duration": 2172
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1240,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002c007f-00dd-00d5-003b-0091006e0026.png",
        "timestamp": 1584819207664,
        "duration": 7326
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8368,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002e0058-00a3-00f5-0018-000900fa00f3.png",
        "timestamp": 1584820016481,
        "duration": 2004
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8368,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007c0072-00ab-000d-0044-004800cb00bc.png",
        "timestamp": 1584820019512,
        "duration": 6704
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 80,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f90008-00ff-001b-00e3-004a005b00d2.png",
        "timestamp": 1584820166150,
        "duration": 1855
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 80,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009d009b-0086-0096-0022-008e001900c6.png",
        "timestamp": 1584820169097,
        "duration": 6089
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13476,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00af0020-00b1-004b-005d-00d80060004d.png",
        "timestamp": 1584820365879,
        "duration": 1822
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13476,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fe00ec-0049-006d-00ed-00360048000e.png",
        "timestamp": 1584820368701,
        "duration": 7032
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10492,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003400fb-0019-00e0-00e2-0092003a0045.png",
        "timestamp": 1584820456542,
        "duration": 1587
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10492,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001a0067-0044-00f3-004b-0086003400d0.png",
        "timestamp": 1584820459313,
        "duration": 6910
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10324,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d00f7-006f-0029-0099-003b00140022.png",
        "timestamp": 1584820500065,
        "duration": 2059
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10324,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00130031-0009-00ae-0091-008000ac0067.png",
        "timestamp": 1584820503113,
        "duration": 6800
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13520,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004000fc-00ae-000e-00b6-0072008a006d.png",
        "timestamp": 1584820793855,
        "duration": 1859
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13520,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00620059-0078-00cc-00a8-009200bc0069.png",
        "timestamp": 1584820796899,
        "duration": 6975
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1892,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ed002e-0036-0053-004b-00c30061004c.png",
        "timestamp": 1584821832790,
        "duration": 1707
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1892,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a700d8-009e-003e-0093-004c003b00b9.png",
        "timestamp": 1584821835838,
        "duration": 6989
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12772,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00be00a5-00d7-00d7-003f-0006008e0086.png",
        "timestamp": 1584822071484,
        "duration": 2639
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12772,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002700c4-00eb-0070-00bc-0085004c005b.png",
        "timestamp": 1584822075203,
        "duration": 6131
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11444,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00790064-0041-004a-00c0-00110097003f.png",
        "timestamp": 1584822135458,
        "duration": 2191
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11444,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003a001c-00b5-003a-000f-0090008e007d.png",
        "timestamp": 1584822138678,
        "duration": 7125
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9812,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e00062-0081-0083-0008-00ff0021005d.png",
        "timestamp": 1584822197991,
        "duration": 1801
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9812,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ca00c4-00d4-0072-00ee-000400b8009f.png",
        "timestamp": 1584822200705,
        "duration": 6732
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8360,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c10019-00a0-0034-0083-00e200c50089.png",
        "timestamp": 1584822280631,
        "duration": 2232
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8360,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006d0029-0016-0066-0052-00ae00a00058.png",
        "timestamp": 1584822283943,
        "duration": 6533
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11696,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000b00be-0044-00a1-00a3-0076009200a2.png",
        "timestamp": 1584822420363,
        "duration": 14
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11696,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001a006e-0061-0051-00f8-00e500d40090.png",
        "timestamp": 1584822420768,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11696,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002100fb-004a-007b-00b3-00ba00f6009c.png",
        "timestamp": 1584822421057,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 11696,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00de0062-003f-006b-00f1-00bf0026005c.png",
        "timestamp": 1584822421287,
        "duration": 0
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11696,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b00c3-003c-00d6-00c8-007500dc008a.png",
        "timestamp": 1584822421595,
        "duration": 33
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "003c000e-0091-0016-0006-007a00d000d7.png",
        "timestamp": 1584822464863,
        "duration": 18
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00fd00df-0027-009e-0054-001500370025.png",
        "timestamp": 1584822465287,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "008a000d-00bd-0044-00cc-00a800c900c7.png",
        "timestamp": 1584822465534,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00df00c0-00e7-00ef-0004-00e4004f006a.png",
        "timestamp": 1584822465867,
        "duration": 0
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10080,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010038-0020-0032-00d3-00000076001c.png",
        "timestamp": 1584822466086,
        "duration": 37
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 6740,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00560008-007f-0059-0096-005500960090.png",
        "timestamp": 1584822504230,
        "duration": 16
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 6740,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001e0001-0030-0087-00ed-001200a90084.png",
        "timestamp": 1584822504667,
        "duration": 1
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 6740,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001000c7-00ba-0080-00f3-0011007d00fe.png",
        "timestamp": 1584822504933,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 6740,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0008000e-0046-003f-00a1-00520019009f.png",
        "timestamp": 1584822505246,
        "duration": 0
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6740,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00350098-00a4-0001-0099-00ac002000a4.png",
        "timestamp": 1584822505463,
        "duration": 37
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11856,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a800b7-000b-00e9-006c-0063005f009e.png",
        "timestamp": 1584822539721,
        "duration": 1892
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11856,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.132"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007700db-00ec-008c-004c-006400580050.png",
        "timestamp": 1584822542740,
        "duration": 7251
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12200,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c007a-0095-00b1-00fd-00d3006c0003.png",
        "timestamp": 1584888056543,
        "duration": 14129
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12200,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005c0031-00d4-005c-00bf-004a00e7003b.png",
        "timestamp": 1584888071658,
        "duration": 22943
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7200,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f009a-008a-0053-008b-009100e000e3.png",
        "timestamp": 1584888328264,
        "duration": 1387
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7200,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00810033-001c-000d-0099-00da00a300ae.png",
        "timestamp": 1584888330449,
        "duration": 6248
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8608,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a3008d-001d-00df-0083-00d0003400e5.png",
        "timestamp": 1584888561187,
        "duration": 1009
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8608,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b200fa-0018-0024-0018-00a100500037.png",
        "timestamp": 1584888562880,
        "duration": 5600
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 12052,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0055001d-00ca-0087-00e0-00de00de00e4.png",
        "timestamp": 1584890951426,
        "duration": 10
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 12052,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00eb0079-0027-00ca-0041-00c400ff0060.png",
        "timestamp": 1584890951815,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 12052,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002d00dd-0066-00a1-003b-0045000e0005.png",
        "timestamp": 1584890952001,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 12052,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "007800d1-00ae-00ac-00fd-003c003d00d0.png",
        "timestamp": 1584890952211,
        "duration": 0
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12052,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a300f7-0001-002e-0043-00c00081004c.png",
        "timestamp": 1584890952403,
        "duration": 22
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8680,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a0005e-00c0-0045-0030-00d1003200f9.png",
        "timestamp": 1584891143670,
        "duration": 912
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8680,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f4001d-004d-0032-00f6-00bd006b00c1.png",
        "timestamp": 1584891145312,
        "duration": 5364
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7264,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00650090-0022-0075-004d-00d3005c0078.png",
        "timestamp": 1584891202597,
        "duration": 985
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7264,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a900e4-00b8-0025-00a4-007700e60045.png",
        "timestamp": 1584891204232,
        "duration": 5827
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13304,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009f0015-004d-000c-002a-00580028009d.png",
        "timestamp": 1584900468277,
        "duration": 1091
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13304,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d50000-00ae-0059-00e1-0010004600f0.png",
        "timestamp": 1584900470247,
        "duration": 6218
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 8720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a8001a-009f-00ea-00e4-001f002d0024.png",
        "timestamp": 1584904974528,
        "duration": 15
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 8720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "009c0031-00c5-00ab-004e-003b0055005e.png",
        "timestamp": 1584904974800,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 8720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000c0000-0066-007e-00de-008300260027.png",
        "timestamp": 1584904974996,
        "duration": 1
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 8720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000c00f3-008d-00be-0001-00d0006e00b3.png",
        "timestamp": 1584904975183,
        "duration": 0
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007100bd-00f3-00d6-0029-00d8003e0012.png",
        "timestamp": 1584904975381,
        "duration": 24
    },
    {
        "description": "Should be able to load the Page|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12748,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b00f0-0008-0074-00cc-00fb00a000d3.png",
        "timestamp": 1584906263338,
        "duration": 1545
    },
    {
        "description": "Should be able to choose framework option from Protractor Set up|Testing the loading functionality",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12748,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003c0089-0045-00f6-0083-001f006400a6.png",
        "timestamp": 1584906265667,
        "duration": 23056
    },
    {
        "description": "Checking toEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 2244,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0010005e-0098-008a-003f-00c4000e00e0.png",
        "timestamp": 1584945722199,
        "duration": 9
    },
    {
        "description": "Checking toBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 2244,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "002700b0-00f3-00ba-008a-008600570087.png",
        "timestamp": 1584945722475,
        "duration": 0
    },
    {
        "description": "Checking NotToEqual() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 2244,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a70077-00a0-0044-0058-00e900e90088.png",
        "timestamp": 1584945722647,
        "duration": 0
    },
    {
        "description": "Checking NotToBe() method|Jasmine Checkpoint and Assertion Validation",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 2244,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00d90058-00f9-00db-0095-00f0007200d5.png",
        "timestamp": 1584945722897,
        "duration": 1
    },
    {
        "description": "Checking other() method|Jasmine Checkpoint and Assertion Validation",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2244,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.149"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b000be-0026-00e6-0047-00c800d900b4.png",
        "timestamp": 1584945723081,
        "duration": 21
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
