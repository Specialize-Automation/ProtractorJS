/**
 * Copyright : Aditya Roy
 */
var wait = function() {
    var ec = protractor.ExpectedConditions;
    
    this.waitTillElementPresent = function(element) {
        browser.wait(ec.visibilityOf(element),10000);
    }
    this.waitTillElementClickable = function(element) {
        browser.wait(ec.elementToBeClickable(element),10000);
    }

}
module.exports = wait