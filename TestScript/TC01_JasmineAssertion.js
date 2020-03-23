/**
Author: Aditya Roy
**/

describe('Jasmine Checkpoint and Assertion Validation', function() {

            xit("Checking toEqual() method",function () {
                    var checkValue = 0;
                    expect(checkValue).toEqual(0);
                    console.log("To Equal Value matched");
            });

            xit("Checking toBe() method",function () {
                    var checkValue = '0';
                    expect(checkValue).toBe('0');
                    console.log("To Be Value matched");
            });

            xit("Checking NotToEqual() method",function () {
                    var checkValue = 0;
                    expect(checkValue).not.toEqual(1)
                    console.log("Not To Equal Value matched");
            });

            xit("Checking NotToBe() method",function () {
                    var checkValue = 0;
                    expect(checkValue).not.toBe('0');
                    console.log("Not To Be Value matched");
            });

            it("Checking other() method",function () {
                    var checkValue = true;
                    expect(checkValue).toBeTruthy();
                    console.log("ToBeTruthy matched");
                    console.log("-------------------------------")
                    var checkValue = false;
                    expect(checkValue).toBeFalsy();
                    console.log("ToBeFalsy matched");
                    console.log("-------------------------------")
                    var checkValue = "Aditya"
                    expect(checkValue).toContain("a");
                    console.log("ToContain matched");
                    console.log("-------------------------------")
                    var checkValue = 5.5
                    expect(checkValue).toBeGreaterThan(5.49);
                    console.log("ToBeGreaterThan matched");
                    console.log("-------------------------------")
                    var checkValue = 5.5
                    expect(checkValue).toBeLessThan(5.51);
                    console.log("ToBeLessThan matched");
                    console.log("-------------------------------")
                    var a;
                    var b = null;
                    expect(a).toBeUndefined();
                    expect(b).toBeNull();
            });
});