/**
 * Author : Aditya Roy
 * Function : To generate JSON Array Data from Excel
 */

//importing packages
var xlsx = require('xlsx');
const fs = require('fs');
var wb = xlsx.readFile('../TestData/TestData.xlsx');
console.log("The SheetName :"+wb.SheetNames);

var ws = wb.Sheets["PAT Automation Data"];
var data = xlsx.utils.sheet_to_json(ws);
console.log("Excel Data Extracted");

//Updating the JSON header as Fetching the First column value of Excel ( ex. TC01 )
//---------------------------------------------------------------------------------
/* This json array contains 1 records > Inside 1st record there are 2 records
[
	{
		"TC01": {
			"Country": "INDIA",
			"Name": "Aditya",
			"Pin": 678598
		},
		"TC02": {
			"Country": "AUSTRALIA",
			"Name": "Hayden",
			"Pin": 559746
        }
    }
] 
*/
//-----------------------Check the below code or comment out-----------------------
var globalArray = [];
var newRecord = {};
data.forEach(function(record){
    newRecord[record.Test_Name]=record;
    delete record.Test_Name;
});

//if not using for each, another way to do that
/* for(const ind in data) {
    var eachData = data[ind];
    newRecord[eachData.Test_Name] = eachData;
    delete eachData.Test_Name;
} */

//pushing the JSON {} inside [] to create the JSON Array
globalArray.push(newRecord);
console.log(globalArray);

//stringify JSON Object
var jsonContent = JSON.stringify(globalArray,null,'\t')
//console.log(jsonContent);
//---------------------------------------------------------------------------------


//To split every row of excel = json array content, To create below format
//---------------------------------------------------------------------------------
/* This json contain 2 record and every record are individual.
[
	{
		"TC01": {
			"Country": "INDIA",
			"Name": "Aditya",
			"Pin": 678598
		}
	},
	{
		"TC02": {
			"Country": "AUSTRALIA",
			"Name": "Hayden",
			"Pin": 559746
		}
    }
]
 */
//-----------------------Check the below code or comment out-----------------------
// var newData = data.map(function(record){
//     var newRecord = {};
//     newRecord[record.Test_Name]=record;
//     delete record.Test_Name;
//     return newRecord;
// });
//stringify JSON Object
//var jsonContent = JSON.stringify(newData,null,'\t')
//console.log(jsonContent);
//---------------------------------------------------------------------------------

 
//write the json data to the filename in same directory provided
//---------------------------------------------------------------------------------
fs.writeFile("TestData.json", jsonContent, 'utf8', function (err) {
    if (err) {
        console.log("An error occured while writing JSON Object to File.");
        return console.log(err);
    }
    console.log("JSON file has been saved.");
});
//---------------------------------------------------------------------------------