/**
 * Copyright : Aditya Roy
 */
var base = function()
{
    var EC = protractor.ExpectedConditions;

    this.enterText = function(element, value)
    {
        browser.sleep(500);
        element.sendKeys(value);
    };

    this.click = function(element)
    {
        browser.sleep(500);
        element.click();
    };

    this.clearInput = function(element)
    {
        browser.sleep(500);
        element.clear();
    };

    this.select = function(element)
    {
        browser.sleep(500);
        element.select();
    }

    this.getElementText = function(element)
    {
        return element.getText().then(function (text){
            return text;
        });
    }
}

module.exports = base
