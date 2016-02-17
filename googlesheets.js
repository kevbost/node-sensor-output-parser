var request             = require("request"),
    cheerio             = require("cheerio"),
    fs                  = require("fs"),
    moment              = require("moment"),
    CronJob             = require("cron").CronJob,
    prepend             = require("prepend-file"),
    auth                = require("./auth.js"),
    url                 = "http://192.168.5.198/index.html?em";
    // url                 = "http://127.0.0.1:8080/index.html";

var GoogleSheet         = require("google-spreadsheet"),
    my_sheet            = new GoogleSheet(auth.secretKey()),
    creds               = require(auth.credsFile());


/*
*   Specify second interval for cronjob
*   1 === 1 second, 30 === 30 second.
*   only accepts 0-59, nothing else.
*/
var interval = 1;


/*
*   Specify local output file to write to
*/
var output_file = "./CSVs/googleduplicate.csv";


/*
*   During init, pushes 0 values to csv
*   This is for specifying the point in which
*   the script has been stopped and started again
*/
var first_run_break_point = true;


/*
*   check for ES2015 Promise support
*   if not, load a polyfill
*/
if(typeof(Promise) != "function"){
    require('es6-promise').polyfill();
}


/*
*   Header to prepend on output.csv
*/
var headerText = "date, input, temperature, humidity, lux\r\n";


/*
*   create the base 'mutated' variable to be mutated
*/
var mutated;


/*
*   cool variable name
*   holds the letters that are used to .split the array
*   mutated.indexOf(what[i])
*/
var whatArray = ["T", "H", "I"];


/*
*   prepAndSplit() runs first
*   Using the whatArray, runs insertCommasLoop(str, what)
*   until complete, then converts mutated into an array
*   [ "split", "by", "commas" ]
*/
var prepAndSplit = function(){
    for (var i = 0; i < whatArray.length; i++){
        insertCommasLoop(mutated, whatArray[i]);
    }
};


/*
*   insertCommasLoop, from prepAndSplit()
*   takes "abc", makes it ["a","b","c"]
*   finds index of "what" from the loop
*   inserts a comma at that index position
*   rejoins ["a",", b","c"] into "a, bc"
*/
var insertCommasLoop = function(str, what){
    var splitter = str.split('');
    splitter.splice(splitter.indexOf(what), 0, ',');
    mutated = splitter.join('');
};


/*
*   removeFirstCharacter() is a funky multi-use
*   function runs first removes white space,
*   does a hard split like insertCommas does
*   removes the first index completely [0],
*   inserts a comma directly after the new first index [0],
*   joins it back together.
*/
var removeFirstCharacter = function(){
    var splitter = mutated.split('');
    splitter.splice(0,1);
    splitter.splice(1,0,",");
    mutated = splitter.join('');
};


/*
*   removeModelNumber() removes index location [1]
*   which is the model number, useless data.
*   splits string by ",", then joins by ",".
*   unlike insertCommas and removeFirstCharacter
*   which split literally every character apart like
*   ["s", "p", "l", "i", "t" ]
*/
var removeModelNumber = function(){
    var splitter = mutated.split(',');
    splitter.splice(1,1);
    mutated = splitter.join(',');
};


/*
*   removePrefixes() deletes the unit
*   designations in front of the numbers,
*   for example "TF:100.75" becomes "100.75"
*
*   If any '%' is found, it will be replaced by '';
*   Fixes percentages being graphed as 0.8 instead of 80.
*/
var removePrefixes = function(){
    var splitter = mutated.split(',');
    var buffer = [];
    buffer.push(splitter[0]);
    for(var i = 1; i < splitter.length; i++){
        buffer.push(splitter[i].substring(3, splitter[i].length).replace( /\%/g, "" ));
    }
    mutated = buffer.join(',');
};


/*
*   complete() Runs last.
*   fs.appendFile will create output_file.
*   It will append new values to the bottom.
*   If file has no header, it will prepend
*   one using check_line();
*
*   It also pushes to a google spreadsheet
*   auth'd to my account.
*   var first_run_break_point is set to true upon each run
*   of this file, then immediately set to false. This
*   will enter a row of 0 values to mark that event.
*/
var complete = function(){
    var date        = moment().format("l H:mm:ss"),
        text        = date + "," + mutated + "\r\n",
        buffer      = mutated.split(','),
        input       = buffer[0],
        temperature = buffer[1],
        humidity    = buffer[2],
        lux         = buffer[3];


    fs.appendFile(output_file, text, function (err) {
        console.log(text);
    });

    my_sheet.useServiceAccountAuth(creds, function(err){
        if (err) {
            console.log(err);
            return;
        } else if (first_run_break_point === true){
            my_sheet.addRow( 1, {
                date: date,
                input: 0,
                temperature: 0,
                humidity: 0,
                lux: 0
            });
            first_run_break_point = false;
        } else {
            my_sheet.addRow( 1, {
                date: date,
                input: input,
                temperature: temperature,
                humidity: humidity,
                lux: lux
            });
        }
    });
};


/*
*   Check to see if output.csv has a header,
*   if not, prepend it to the top.
*   Allows text to be written before check to prevent
*   an error if the file does not exist.
*
*   I took both of these from stackoverflow
*   they've got some mysterious magic happening, idk
*/
var check_line = function(){
    get_line(output_file, 0, function(err, line){
        if (!err){
            var buffer = line.split(',');
            if(buffer[0] == 'date'){
                return;
            } else {
                prepend(output_file, headerText);
            }
        }
        return;
    });
};
var get_line = function(filename, line_no, callback) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\r\n");
    if(+line_no > lines.length){
      throw new Error('File end reached without finding line');
    }
    callback(null, lines[+line_no]);
};


/*
*   Cron for the win!
*   Runs every thirty seconds.
*
*   requests the url (similar to http.get).
*   finds the text inside the body using jquery (cheerio for the win!).
*   removes all leading/trailing whitespace including inside the string.
*   begins the promise stream.
*
*/
new CronJob('*/' + interval + ' * * * * *', function() {
    console.log('You will see this message every 30 seconds');

    request(url, function (error, response, body) {
        if (!error) {
            var $ = cheerio.load(body);
            var rawResponse = $("body").text();
            mutated = rawResponse.replace(/\s+/g, '');
            Promise.all(
                [
                    removeFirstCharacter(),
                    prepAndSplit(),
                    removeModelNumber(),
                    removePrefixes(),
                    complete(),
                    check_line()
                ]
            ).then(function() {
                console.log("completed transformation:", mutated);
            });

        } else {
            console.log("We’ve encountered an error: " + error);
        }
    });
}, null, true);


/*
*   fin
*/